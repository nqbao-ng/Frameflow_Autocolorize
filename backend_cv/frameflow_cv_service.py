#!/usr/bin/env python3
"""
FrameFlow CV Service
Production-oriented, stateless API for the React/Vercel/Supabase app.

Core colorization does NOT generate images with Stability/OpenAI/Gemini.
It preserves lineart by using deterministic CV:
  current sketch + trusted reference sketch + trusted reference colored image
  -> OpenCV line masks + connected components
  -> color extraction from trusted keyframe
  -> optical-flow / feature matching propagation
  -> colorized PNG + low-confidence overlay + segment metadata

Optional Vision AI uses Amazon Nova on Bedrock only for semantic role/color suggestion.
It never edits/generates the image.
"""

from __future__ import annotations

import base64
import io
import json
import math
import os
import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont

from vision_ai_service import bedrock_enabled, suggest_segment_role_color
from stability_image_service import (
    StabilityImageServiceError,
    generate_control_sketch,
    generate_outpaint,
    service_status as stability_service_status,
)
from sketch_analysis_service import analyze_sketch, SketchAnalysisServiceError
from creative_job_worker import enqueue_job, start_worker, stop_worker, worker_status

# -----------------------------------------------------------------------------
# App / security
# -----------------------------------------------------------------------------

API_KEY = os.getenv("FRAMEFLOW_CV_API_KEY", "").strip()
REQUIRE_API_KEY = os.getenv("FRAMEFLOW_REQUIRE_API_KEY", "true").strip().lower() in {"true", "1", "yes"}
MAX_DOWNLOAD_BYTES = int(os.getenv("FRAMEFLOW_MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))
DEFAULT_TIMEOUT = float(os.getenv("FRAMEFLOW_HTTP_TIMEOUT", "25"))

app = FastAPI(title="FrameFlow CV Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_frameflow_key: Optional[str]) -> None:
    if not API_KEY:
        if REQUIRE_API_KEY:
            raise HTTPException(status_code=503, detail="FRAMEFLOW_CV_API_KEY is not configured")
        return
    if x_frameflow_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid FRAMEFLOW_CV_API_KEY")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "frameflow_cv_service",
        "bedrock_enabled": bedrock_enabled(),
        "stability_image_services": stability_service_status(),
        "creative_worker": worker_status(),
    }

@app.get("/")
def root() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "frameflow_cv_service",
        "message": "FrameFlow CV backend is running",
        "health": "/health",
    }
# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class AnalyzeSettings(BaseModel):
    line_threshold: int = 180
    adaptive_threshold: bool = True
    gap_close_kernel: int = 3
    gap_close_iterations: int = 1
    line_dilate: int = 1
    min_segment_area: int = 25
    max_side: int = 0
    low_confidence_threshold: float = 0.55
    flow_min_ratio: float = 0.16
    use_flow: bool = True
    line_mode: str = "original"  # original | black
    max_low_confidence: int = 20
    min_review_area: int = 120
    min_review_area_ratio: float = 0.0005
    use_role_memory: bool = True
    role_memory_override_max_confidence: float = 0.55


class RoleMemoryItem(BaseModel):
    role_id: str
    locked_color: Optional[str] = None
    source_segment_id: Optional[int] = None
    priority: int = 0
    is_locked: bool = True


class ColorizeFrameRequest(BaseModel):
    project_id: str
    job_id: Optional[str] = None
    frame_id: str
    frame_name: str = "frame.png"
    frame_index: int = 0

    source_image_url: str
    reference_line_url: str
    reference_color_url: str
    reference_frame_id: Optional[str] = None

    role_memory: List[RoleMemoryItem] = Field(default_factory=list)
    settings: AnalyzeSettings = Field(default_factory=AnalyzeSettings)


class CreativeJobEnqueueRequest(BaseModel):
    job_id: str = Field(min_length=1, max_length=100)


class StabilitySketchAnalysisRequest(BaseModel):
    image_base64: str
    style_hint: Optional[str] = None


class StabilitySketchRequest(BaseModel):
    image_base64: str
    prompt: str = Field(min_length=1, max_length=10000)
    negative_prompt: Optional[str] = Field(default=None, max_length=10000)
    control_strength: float = Field(default=0.78, ge=0.0, le=1.0)
    style_preset: Optional[str] = None
    seed: Optional[int] = Field(default=None, ge=0, le=4294967294)


class StabilityOutpaintRequest(BaseModel):
    image_base64: str
    prompt: Optional[str] = Field(default=None, max_length=10000)
    left: int = Field(default=0, ge=0, le=2000)
    right: int = Field(default=0, ge=0, le=2000)
    up: int = Field(default=0, ge=0, le=2000)
    down: int = Field(default=0, ge=0, le=2000)
    creativity: float = Field(default=0.5, ge=0.1, le=1.0)
    style_preset: Optional[str] = None
    seed: Optional[int] = Field(default=None, ge=0, le=4294967294)


class VisionSuggestRequest(BaseModel):
    project_id: str
    job_id: Optional[str] = None
    frame_id: str
    frame_name: str = "frame.png"
    segment_id: int

    line_url: Optional[str] = None
    segment_ids_url: Optional[str] = None
    colorized_url: Optional[str] = None
    reference_url: Optional[str] = None
    segments: List[Dict[str, Any]] = Field(default_factory=list)
    role_memory: List[RoleMemoryItem] = Field(default_factory=list)


@dataclass
class Segment:
    segment_id: int
    area: int
    area_ratio: float
    bbox: Tuple[int, int, int, int]
    centroid: Tuple[float, float]
    touches_border: bool
    aspect: float
    hu: List[float]
    pattern_score: float


@dataclass
class FrameAnalysis:
    frame_name: str
    width: int
    height: int
    line_rgb: np.ndarray
    gray: np.ndarray
    line_mask_raw: np.ndarray
    line_mask_boundary: np.ndarray
    labels: np.ndarray
    segments: List[Segment]

# -----------------------------------------------------------------------------
# Image helpers
# -----------------------------------------------------------------------------


def download_bytes(url: str) -> bytes:
    if not url:
        raise HTTPException(status_code=400, detail="Missing image URL")
    if url.startswith("data:"):
        _, b64 = url.split(",", 1)
        return base64.b64decode(b64)

    r = requests.get(url, timeout=DEFAULT_TIMEOUT, stream=True)
    r.raise_for_status()
    chunks = []
    total = 0
    for chunk in r.iter_content(chunk_size=65536):
        if not chunk:
            continue
        total += len(chunk)
        if total > MAX_DOWNLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Image too large")
        chunks.append(chunk)
    return b"".join(chunks)


def read_rgb_from_bytes(data: bytes) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(data)).convert("RGB"))


def read_rgb_url(url: str) -> np.ndarray:
    return read_rgb_from_bytes(download_bytes(url))


def save_png_bytes(arr: np.ndarray) -> bytes:
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def png_b64(arr: np.ndarray) -> str:
    return base64.b64encode(save_png_bytes(arr)).decode("utf-8")


def json_b64(obj: Any) -> str:
    return base64.b64encode(json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")).decode("utf-8")


def resize_like(rgb: np.ndarray, hw: Tuple[int, int], interpolation=cv2.INTER_AREA) -> np.ndarray:
    h, w = hw
    if rgb.shape[:2] == (h, w):
        return rgb
    return cv2.resize(rgb, (w, h), interpolation=interpolation)


def resize_max_side(rgb: np.ndarray, max_side: int) -> np.ndarray:
    if max_side <= 0:
        return rgb
    h, w = rgb.shape[:2]
    scale = min(1.0, float(max_side) / max(h, w))
    if scale >= 1.0:
        return rgb
    nw, nh = int(round(w * scale)), int(round(h * scale))
    return cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_AREA)


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))


def hex_to_rgb(x: str) -> Tuple[int, int, int]:
    h = str(x).strip().lstrip("#")
    if len(h) != 6:
        raise ValueError(f"Invalid hex color: {x}")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# -----------------------------------------------------------------------------
# CV analysis
# -----------------------------------------------------------------------------


def extract_line_masks(
    line_rgb: np.ndarray,
    cfg: AnalyzeSettings,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(line_rgb, cv2.COLOR_RGB2GRAY)
    threshold_mask = gray < int(cfg.line_threshold)

    if cfg.adaptive_threshold:
        adaptive = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            31,
            8,
        ) > 0
        raw = threshold_mask | adaptive
    else:
        raw = threshold_mask

    raw_u8 = raw.astype(np.uint8) * 255
    raw_u8 = cv2.morphologyEx(raw_u8, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)

    boundary = raw_u8.copy()
    k = max(1, int(cfg.gap_close_kernel))
    if k % 2 == 0:
        k += 1
    if k > 1 and cfg.gap_close_iterations > 0:
        boundary = cv2.morphologyEx(
            boundary,
            cv2.MORPH_CLOSE,
            np.ones((k, k), np.uint8),
            iterations=int(cfg.gap_close_iterations),
        )
    if cfg.line_dilate > 0:
        dk = 2 * int(cfg.line_dilate) + 1
        boundary = cv2.dilate(boundary, np.ones((dk, dk), np.uint8), iterations=1)
    return gray, raw_u8 > 0, boundary > 0


def compute_hu(mask: np.ndarray) -> List[float]:
    m = cv2.moments(mask.astype(np.uint8))
    hu = cv2.HuMoments(m).flatten()
    out: List[float] = []
    for x in hu:
        out.append(float(-math.copysign(1.0, float(x)) * math.log10(abs(float(x)) + 1e-12)))
    return out


def estimate_pattern_score(line_raw: np.ndarray, bbox: Tuple[int, int, int, int], area: int, image_area: int) -> float:
    x, y, w, h = bbox
    if w <= 0 or h <= 0:
        return 0.0
    pad = 3
    y0, y1 = max(0, y - pad), min(line_raw.shape[0], y + h + pad)
    x0, x1 = max(0, x - pad), min(line_raw.shape[1], x + w + pad)
    crop = line_raw[y0:y1, x0:x1]
    line_density = float(crop.mean()) if crop.size else 0.0
    aspect = w / max(1, h)
    elongation = min(abs(math.log(max(aspect, 1e-6))) / math.log(8), 1.0)
    area_ratio = area / max(1, image_area)
    score = 0.55 * elongation + 0.45 * min(line_density / 0.25, 1.0)
    if area_ratio > 0.10:
        score *= 0.25
    return float(max(0.0, min(1.0, score)))


def analyze_line_rgb(rgb: np.ndarray, cfg: AnalyzeSettings, frame_name: str = "frame.png", target_hw: Optional[Tuple[int, int]] = None) -> FrameAnalysis:
    rgb = resize_max_side(rgb, cfg.max_side)
    if target_hw is not None:
        rgb = resize_like(rgb, target_hw)
    h, w = rgb.shape[:2]
    image_area = h * w

    gray, line_raw, line_boundary = extract_line_masks(rgb, cfg)
    fillable = (~line_boundary).astype(np.uint8)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(fillable, connectivity=4)

    segments: List[Segment] = []
    for sid in range(1, num):
        area = int(stats[sid, cv2.CC_STAT_AREA])
        if area < max(1, int(cfg.min_segment_area)):
            labels[labels == sid] = 0
            continue
        x = int(stats[sid, cv2.CC_STAT_LEFT])
        y = int(stats[sid, cv2.CC_STAT_TOP])
        bw = int(stats[sid, cv2.CC_STAT_WIDTH])
        bh = int(stats[sid, cv2.CC_STAT_HEIGHT])
        mask = labels == sid
        cx, cy = float(centroids[sid][0]), float(centroids[sid][1])
        touches = x <= 0 or y <= 0 or (x + bw) >= w or (y + bh) >= h
        aspect = float(bw / max(1, bh))
        segments.append(
            Segment(
                segment_id=int(sid),
                area=area,
                area_ratio=float(area / max(1, image_area)),
                bbox=(x, y, bw, bh),
                centroid=(cx, cy),
                touches_border=bool(touches),
                aspect=aspect,
                hu=compute_hu(mask),
                pattern_score=estimate_pattern_score(line_raw, (x, y, bw, bh), area, image_area),
            )
        )

    return FrameAnalysis(frame_name, w, h, rgb, gray, line_raw, line_boundary, labels.astype(np.int32), segments)

# -----------------------------------------------------------------------------
# Color extraction / rendering
# -----------------------------------------------------------------------------


def dominant_segment_color(color_rgb: np.ndarray, mask: np.ndarray) -> Tuple[int, int, int]:
    pixels = color_rgb[mask]
    if pixels.size == 0:
        return (255, 255, 255)
    gray = cv2.cvtColor(pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2GRAY).reshape(-1)
    usable = pixels[gray > 25]
    if len(usable) == 0:
        usable = pixels
    med = np.median(usable, axis=0)
    return tuple(np.clip(np.round(med), 0, 255).astype(int).tolist())


def extract_keyframe_colors(analysis: FrameAnalysis, color_rgb: np.ndarray) -> Dict[int, Tuple[int, int, int]]:
    color_rgb = resize_like(color_rgb, (analysis.height, analysis.width))
    colors: Dict[int, Tuple[int, int, int]] = {}
    for seg in analysis.segments:
        colors[seg.segment_id] = dominant_segment_color(color_rgb, analysis.labels == seg.segment_id)
    return colors


def render_colorized(a: FrameAnalysis, colors: Dict[int, Tuple[int, int, int]], line_mode: str = "original") -> np.ndarray:
    out = np.zeros((a.height, a.width, 3), dtype=np.uint8) + 255
    for sid, color in colors.items():
        out[a.labels == int(sid)] = np.array(color, dtype=np.uint8)
    if line_mode == "black":
        out[a.line_mask_raw] = np.array([0, 0, 0], dtype=np.uint8)
    else:
        out[a.line_mask_raw] = a.line_rgb[a.line_mask_raw]
    return out


def create_rainbow_segments(a: FrameAnalysis) -> np.ndarray:
    out = np.zeros((a.height, a.width, 3), dtype=np.uint8) + 255
    for seg in a.segments:
        rng = np.random.default_rng(seg.segment_id * 9973 + 123)
        out[a.labels == seg.segment_id] = rng.integers(35, 235, size=3).astype(np.uint8)
    out[a.line_mask_raw] = np.array([0, 0, 0], dtype=np.uint8)
    return out




def create_encoded_segment_map(a: FrameAnalysis) -> np.ndarray:
    """RGB label map used by the web editor for exact click-to-segment recolor.

    Encoding: segment_id = R + (G << 8) + (B << 16).
    Label 0 remains black and means line/background/no selectable segment.
    """
    out = np.zeros((a.height, a.width, 3), dtype=np.uint8)
    labels = np.clip(a.labels.astype(np.int64), 0, 16_777_215)
    out[..., 0] = (labels & 255).astype(np.uint8)
    out[..., 1] = ((labels >> 8) & 255).astype(np.uint8)
    out[..., 2] = ((labels >> 16) & 255).astype(np.uint8)
    out[a.line_mask_raw] = np.array([0, 0, 0], dtype=np.uint8)
    return out

def draw_segment_ids(base_rgb: np.ndarray, a: FrameAnalysis, max_ids: int = 300) -> np.ndarray:
    img = Image.fromarray(base_rgb.astype(np.uint8), mode="RGB")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 12)
    except Exception:
        font = ImageFont.load_default()
    large = [s for s in a.segments if s.area >= 25]
    for seg in sorted(large, key=lambda s: s.area, reverse=True)[:max_ids]:
        x, y = int(seg.centroid[0]), int(seg.centroid[1])
        text = str(seg.segment_id)
        draw.text((x + 1, y + 1), text, fill=(255, 255, 255), font=font)
        draw.text((x, y), text, fill=(0, 0, 0), font=font)
    return np.array(img)


def confidence_overlay(colorized: np.ndarray, a: FrameAnalysis, conf: Dict[int, float], threshold: float) -> np.ndarray:
    out = colorized.astype(np.float32)
    red = np.array([255, 40, 40], dtype=np.float32)
    for seg in a.segments:
        if float(conf.get(seg.segment_id, 1.0)) < threshold:
            mask = a.labels == seg.segment_id
            out[mask] = 0.58 * out[mask] + 0.42 * red
    return np.clip(out, 0, 255).astype(np.uint8)

# -----------------------------------------------------------------------------
# Propagation
# -----------------------------------------------------------------------------


def warp_previous_labels_to_current(prev: FrameAnalysis, curr: FrameAnalysis) -> np.ndarray:
    flow_back = cv2.calcOpticalFlowFarneback(
        curr.gray,
        prev.gray,
        None,
        pyr_scale=0.5,
        levels=4,
        winsize=31,
        iterations=5,
        poly_n=7,
        poly_sigma=1.5,
        flags=0,
    )
    h, w = curr.gray.shape
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    mx = (gx + flow_back[..., 0]).astype(np.float32)
    my = (gy + flow_back[..., 1]).astype(np.float32)
    return cv2.remap(
        prev.labels.astype(np.float32),
        mx,
        my,
        interpolation=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    ).astype(np.int32)


def feature_cost(a: Segment, b: Segment, width: int, height: int) -> float:
    diag = math.sqrt(width * width + height * height) + 1e-6
    centroid_cost = math.sqrt((a.centroid[0] - b.centroid[0]) ** 2 + (a.centroid[1] - b.centroid[1]) ** 2) / diag
    area_cost = abs(math.log((a.area + 1.0) / (b.area + 1.0)))
    aspect_cost = abs(math.log((a.aspect + 1e-6) / (b.aspect + 1e-6)))
    border_cost = 0.0 if a.touches_border == b.touches_border else 0.45
    hu_cost = float(np.mean(np.abs(np.array(a.hu[:4]) - np.array(b.hu[:4]))))
    hu_cost = min(hu_cost / 12.0, 1.0)
    pattern_cost = abs(a.pattern_score - b.pattern_score)
    return 1.60 * centroid_cost + 0.55 * min(area_cost, 2.0) + 0.35 * min(aspect_cost, 2.0) + border_cost + 0.35 * hu_cost + 0.25 * pattern_cost


def choose_background_color(prev: FrameAnalysis, prev_colors: Dict[int, Tuple[int, int, int]]) -> Tuple[int, int, int]:
    bg = [s for s in prev.segments if s.touches_border and s.segment_id in prev_colors]
    if not bg:
        return (255, 255, 255)
    return prev_colors[max(bg, key=lambda s: s.area).segment_id]


def propagate_colors(prev: FrameAnalysis, prev_colors: Dict[int, Tuple[int, int, int]], curr: FrameAnalysis, cfg: AnalyzeSettings):
    colors: Dict[int, Tuple[int, int, int]] = {}
    confidence: Dict[int, float] = {}
    match_info: Dict[int, Dict[str, Any]] = {}

    bg = choose_background_color(prev, prev_colors)
    prev_seg_by_id = {s.segment_id: s for s in prev.segments if s.segment_id in prev_colors}
    prev_segs = list(prev_seg_by_id.values())

    if cfg.use_flow and prev.gray.shape == curr.gray.shape:
        try:
            warped = warp_previous_labels_to_current(prev, curr)
            for seg in curr.segments:
                vals = warped[curr.labels == seg.segment_id]
                vals = vals[vals > 0]
                if len(vals) == 0:
                    continue
                u, c = np.unique(vals, return_counts=True)
                candidates = [(int(x), int(n)) for x, n in zip(u, c) if int(x) in prev_colors]
                if not candidates:
                    continue
                best_prev, best_count = max(candidates, key=lambda x: x[1])
                ratio = float(best_count / max(1, seg.area))
                if ratio >= cfg.flow_min_ratio:
                    colors[seg.segment_id] = prev_colors[best_prev]
                    confidence[seg.segment_id] = min(0.98, max(0.05, ratio))
                    match_info[seg.segment_id] = {
                        "method": "optical_flow_majority",
                        "matched_prev_segment": best_prev,
                        "flow_ratio": round(ratio, 4),
                    }
        except Exception as e:
            match_info[-1] = {"flow_error": str(e)}

    for seg in curr.segments:
        if seg.segment_id in colors:
            continue
        candidates = prev_segs
        if seg.touches_border:
            border_candidates = [s for s in prev_segs if s.touches_border]
            if border_candidates:
                candidates = border_candidates
        if not candidates:
            colors[seg.segment_id] = bg
            confidence[seg.segment_id] = 0.0
            match_info[seg.segment_id] = {"method": "no_candidate"}
            continue

        best_prev = None
        best_cost = float("inf")
        for prev_seg in candidates:
            cost = feature_cost(prev_seg, seg, curr.width, curr.height)
            if cost < best_cost:
                best_cost = cost
                best_prev = prev_seg
        if best_prev is None:
            colors[seg.segment_id] = bg
            confidence[seg.segment_id] = 0.0
            match_info[seg.segment_id] = {"method": "fallback_none"}
        else:
            colors[seg.segment_id] = prev_colors.get(best_prev.segment_id, bg)
            conf = float(math.exp(-1.75 * best_cost))
            if seg.touches_border and best_prev.touches_border:
                conf = max(conf, 0.65)
            confidence[seg.segment_id] = max(0.02, min(0.92, conf))
            match_info[seg.segment_id] = {
                "method": "feature_fallback",
                "matched_prev_segment": best_prev.segment_id,
                "cost": round(float(best_cost), 4),
            }
    return colors, confidence, match_info


def guess_role(seg: Segment, width: int, height: int) -> str:
    x, y, w, h = seg.bbox
    cy = seg.centroid[1] / max(1, height)
    area = seg.area_ratio
    if seg.touches_border and area > 0.08:
        return "background"
    if cy < 0.28 and area > 0.006:
        return "hair"
    if 0.22 <= cy <= 0.45 and area < 0.04:
        return "skin"
    if 0.35 <= cy <= 0.68:
        return "shirt"
    if cy > 0.62 and area > 0.002:
        return "pants"
    if cy > 0.78:
        return "shoes"
    if seg.pattern_score > 0.65:
        return "accessory"
    return "object"

def _memory_attr(item: Any, name: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def role_memory_map(role_memory: List[RoleMemoryItem]) -> Dict[str, Tuple[int, int, int]]:
    out: Dict[str, Tuple[int, int, int]] = {}
    if not role_memory:
        return out

    def priority(item: RoleMemoryItem) -> int:
        try:
            return int(_memory_attr(item, "priority", 0) or 0)
        except Exception:
            return 0

    for item in sorted(role_memory, key=priority, reverse=True):
        role = str(_memory_attr(item, "role_id", "") or "").strip().lower()
        color_hex = str(_memory_attr(item, "locked_color", "") or "").strip()
        is_locked = bool(_memory_attr(item, "is_locked", True))
        if not role or not color_hex or not is_locked:
            continue
        if role in out:
            continue
        try:
            out[role] = hex_to_rgb(color_hex)
        except Exception:
            continue
    return out


def apply_role_memory_hints(
    a: FrameAnalysis,
    colors: Dict[int, Tuple[int, int, int]],
    confidence: Dict[int, float],
    match_info: Dict[int, Dict[str, Any]],
    role_memory: List[RoleMemoryItem],
    cfg: AnalyzeSettings,
) -> None:
    if not bool(getattr(cfg, "use_role_memory", True)):
        return

    memory = role_memory_map(role_memory)
    if not memory:
        return

    max_conf = float(getattr(cfg, "role_memory_override_max_confidence", 0.55))

    for seg in a.segments:
        seg_id = int(seg.segment_id)
        old_conf = float(confidence.get(seg_id, 0.0))

        if old_conf > max_conf:
            continue

        role = guess_role(seg, a.width, a.height)
        role_key = str(role or "").strip().lower()

        if role_key in {"", "background", "unknown"}:
            continue

        if role_key not in memory:
            continue

        colors[seg_id] = memory[role_key]
        confidence[seg_id] = max(old_conf, min(0.72, max_conf + 0.12))

        match_info[seg_id] = {
            **match_info.get(seg_id, {}),
            "method": "role_memory_low_confidence_hint",
            "role_id": role_key,
            "color_hex": rgb_to_hex(memory[role_key]),
            "previous_confidence": round(old_conf, 4),
            "confidence": round(float(confidence[seg_id]), 4),
        }
        
def count_low_confidence(a: FrameAnalysis, conf: Dict[int, float], cfg: AnalyzeSettings) -> int:
    cnt = 0
    for seg in a.segments:
        if seg.area < cfg.min_review_area:
            continue
        if seg.area_ratio < cfg.min_review_area_ratio:
            continue
        if float(conf.get(seg.segment_id, 0.0)) < cfg.low_confidence_threshold:
            cnt += 1
    return cnt


def build_segment_records(a: FrameAnalysis, colors: Dict[int, Tuple[int, int, int]], confidence: Dict[int, float], match_info: Dict[int, Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for seg in a.segments:
        color = colors.get(seg.segment_id, (255, 255, 255))
        role = guess_role(seg, a.width, a.height)
        conf = round(float(confidence.get(seg.segment_id, 0.0)), 4)
        rows.append({
            **asdict(seg),
            "bbox": list(seg.bbox),
            "centroid": list(seg.centroid),
            "assigned_color": rgb_to_hex(color),
            "suggested_color": rgb_to_hex(color),
            "color_hex": rgb_to_hex(color),
            "role_guess": role,
            "role_id": role,
            "confidence": conf,
            "reason": "CV propagation by optical flow/feature matching" if conf >= 0.55 else "Low confidence match; review recommended",
            "match": match_info.get(seg.segment_id, {}),
        })
    return rows

# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------


@app.post("/v1/colorize-frame")
def colorize_frame(req: ColorizeFrameRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    cfg = req.settings

    try:
        curr_rgb = read_rgb_url(req.source_image_url)
        curr_analysis = analyze_line_rgb(curr_rgb, cfg, frame_name=req.frame_name)

        ref_line_rgb = read_rgb_url(req.reference_line_url)
        ref_line_rgb = resize_like(ref_line_rgb, (curr_analysis.height, curr_analysis.width))
        ref_color_rgb = read_rgb_url(req.reference_color_url)
        ref_color_rgb = resize_like(ref_color_rgb, (curr_analysis.height, curr_analysis.width))

        ref_analysis = analyze_line_rgb(ref_line_rgb, cfg, frame_name="reference.png", target_hw=(curr_analysis.height, curr_analysis.width))
        ref_colors = extract_keyframe_colors(ref_analysis, ref_color_rgb)

        colors, conf, match = propagate_colors(ref_analysis, ref_colors, curr_analysis, cfg)
        apply_role_memory_hints(curr_analysis, colors, conf, match, req.role_memory, cfg)
        low_count = count_low_confidence(curr_analysis, conf, cfg)
        status = "colorized" if low_count <= int(cfg.max_low_confidence) else "needs_review_not_reference"

        colorized = render_colorized(curr_analysis, colors, line_mode=cfg.line_mode)
        overlay = confidence_overlay(colorized, curr_analysis, conf, cfg.low_confidence_threshold)
        segment_ids = draw_segment_ids(create_rainbow_segments(curr_analysis), curr_analysis)
        encoded_segment_map = create_encoded_segment_map(curr_analysis)
        segments = build_segment_records(curr_analysis, colors, conf, match)
        confidence_score = float(np.mean([conf.get(s.segment_id, 0.0) for s in curr_analysis.segments])) if curr_analysis.segments else 0.0

        return {
            "ok": True,
            "status": status,
            "frame_id": req.frame_id,
            "frame_name": req.frame_name,
            "reference_frame_id": req.reference_frame_id,
            "confidence_score": round(confidence_score, 4),
            "low_confidence_count": low_count,
            "num_segments": len(curr_analysis.segments),
            "reason": "Lineart-preserving CV propagation completed." if status == "colorized" else "Some regions have low matching confidence and need review.",
            "segments": segments,
            "assets": {
                "colorized_png_base64": png_b64(colorized),
                "low_confidence_overlay_png_base64": png_b64(overlay),
                "segment_ids_png_base64": png_b64(segment_ids),
                "encoded_segment_map_png_base64": png_b64(encoded_segment_map),
                "segments_json_base64": json_b64(segments),
            },
            "debug": {
                "engine": "frameflow_cv_service",
                "core": "opencv_connected_components_optical_flow_feature_matching",
                "generation_api": "none",
                "role_memory_used": bool(req.role_memory) and bool(cfg.use_role_memory),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CV colorization failed: {e}")

# -----------------------------------------------------------------------------
# Vision suggestion: Amazon Bedrock Nova optional, heuristic fallback always available
# -----------------------------------------------------------------------------


def role_memory_item_to_dict(item: RoleMemoryItem) -> Dict[str, Any]:
    return {
        "role_id": item.role_id,
        "locked_color": item.locked_color,
        "source_segment_id": item.source_segment_id,
        "priority": item.priority,
        "is_locked": item.is_locked,
    }


def optional_download(url: Optional[str]) -> Optional[bytes]:
    if not url:
        return None
    try:
        return download_bytes(url)
    except Exception:
        return None


@app.post("/v1/vision-suggest")
def vision_suggest(req: VisionSuggestRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """Suggest semantic role/color for one segment.

    This endpoint is intentionally NOT part of the automatic CV colorization path.
    It is called only from the Review/Correction panel. The returned suggestion is
    saved as pending_user_confirm in Vercel/Supabase; Role Memory is updated only
    after the user applies the correction.
    """
    require_api_key(x_frameflow_key)
    role_memory = [role_memory_item_to_dict(item) for item in req.role_memory]
    return suggest_segment_role_color(
        segment_id=int(req.segment_id),
        segments=req.segments,
        role_memory=role_memory,
        line_bytes=optional_download(req.line_url),
        colorized_bytes=optional_download(req.colorized_url),
        segment_ids_bytes=optional_download(req.segment_ids_url),
        reference_bytes=optional_download(req.reference_url),
    )


# -----------------------------------------------------------------------------
# Stability AI Image Services through Amazon Bedrock
# -----------------------------------------------------------------------------


@app.on_event("startup")
def start_creative_worker_on_startup() -> None:
    start_worker()


@app.on_event("shutdown")
def stop_creative_worker_on_shutdown() -> None:
    stop_worker()


@app.get("/v1/creative/status")
def creative_status(x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    return {**stability_service_status(), "creative_worker": worker_status()}


@app.post("/v1/creative/jobs/enqueue")
def creative_enqueue_job(req: CreativeJobEnqueueRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    try:
        return enqueue_job(req.job_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/v1/creative/analyze-sketch")
def creative_analyze_sketch(req: StabilitySketchAnalysisRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    try:
        return analyze_sketch(
            image_base64=req.image_base64,
            style_hint=req.style_hint,
        )
    except SketchAnalysisServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.details) from exc


@app.post("/v1/creative/sketch")
def creative_sketch(req: StabilitySketchRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    try:
        return generate_control_sketch(
            image_base64=req.image_base64,
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            control_strength=req.control_strength,
            style_preset=req.style_preset,
            seed=req.seed,
        )
    except StabilityImageServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.details) from exc


@app.post("/v1/creative/outpaint")
def creative_outpaint(req: StabilityOutpaintRequest, x_frameflow_key: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    require_api_key(x_frameflow_key)
    try:
        return generate_outpaint(
            image_base64=req.image_base64,
            prompt=req.prompt,
            left=req.left,
            right=req.right,
            up=req.up,
            down=req.down,
            creativity=req.creativity,
            style_preset=req.style_preset,
            seed=req.seed,
        )
    except StabilityImageServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.details) from exc
