"""Amazon Bedrock Nova helper for FrameFlow Vision Suggest.

This module is intentionally suggestion-only:
- It does NOT edit, recolor, or generate images.
- It only returns role_id + color_hex + confidence + reason for one selected segment.
- If Bedrock is disabled or fails, it returns a deterministic CV/Role Memory fallback.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

try:
    import boto3
except Exception:  # boto3 is optional until Bedrock is enabled
    boto3 = None  # type: ignore

ALLOWED_ROLES = [
    "skin",
    "hair",
    "face",
    "shirt",
    "pants",
    "shoes",
    "accessory",
    "object",
    "background",
    "unknown",
]

ROLE_DEFAULT_COLORS = {
    "skin": "#F2B08C",
    "hair": "#1E293B",
    "face": "#F2B08C",
    "shirt": "#3B82F6",
    "pants": "#334155",
    "shoes": "#111827",
    "accessory": "#F59E0B",
    "object": "#3B82F6",
    "background": "#E5E7EB",
    "unknown": "#3B82F6",
}


@dataclass
class VisionAiResult:
    ok: bool
    provider: str
    segment_id: int
    role_id: str
    color_hex: str
    confidence: float
    reason: str
    model_id: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "provider": self.provider,
            "model_id": self.model_id,
            "segment_id": self.segment_id,
            "role_id": self.role_id,
            "color_hex": self.color_hex,
            "confidence": round(float(self.confidence), 4),
            "reason": self.reason,
            "raw_response": self.raw_response or {},
        }


def bedrock_enabled() -> bool:
    return os.getenv("FRAMEFLOW_ENABLE_BEDROCK_VISION", "false").strip().lower() == "true" and boto3 is not None


def normalize_hex_color(value: Any, fallback: str = "#3B82F6") -> str:
    raw = str(value or "").strip()
    if re.match(r"^#?[0-9a-fA-F]{6}$", raw):
        return (raw if raw.startswith("#") else f"#{raw}").upper()
    return fallback.upper()


def normalize_role_id(value: Any) -> str:
    role = re.sub(r"[^a-z0-9_\-]", "_", str(value or "unknown").strip().lower())
    role = re.sub(r"_+", "_", role).strip("_") or "unknown"
    # Map common model wording back to product roles.
    aliases = {
        "clothes": "shirt",
        "top": "shirt",
        "upper_clothing": "shirt",
        "lower_clothing": "pants",
        "trousers": "pants",
        "shoe": "shoes",
        "background_area": "background",
        "prop": "object",
        "item": "object",
    }
    return aliases.get(role, role if role in ALLOWED_ROLES else "object")


def role_memory_color(role_memory: Iterable[Dict[str, Any]], role: str, fallback: str = "#3B82F6") -> str:
    candidates = []
    for item in role_memory or []:
        if str(item.get("role_id") or "").strip().lower() == role and item.get("locked_color"):
            candidates.append(item)
    if not candidates:
        return normalize_hex_color(fallback, ROLE_DEFAULT_COLORS.get(role, "#3B82F6"))
    candidates.sort(key=lambda x: int(x.get("priority") or 0), reverse=True)
    return normalize_hex_color(candidates[0].get("locked_color"), fallback)


def extract_json_object(text: str) -> Dict[str, Any]:
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    match = re.search(r"\{.*\}", raw, flags=re.S)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON object found in model response")


def selected_segment_metadata(segments: List[Dict[str, Any]], segment_id: int) -> Dict[str, Any]:
    for seg in segments or []:
        try:
            if int(seg.get("segment_id", -999999)) == int(segment_id):
                return dict(seg)
        except Exception:
            continue
    return {
        "segment_id": segment_id,
        "role_guess": "object",
        "suggested_color": "#3B82F6",
        "confidence": 0.55,
    }


def heuristic_suggest(
    *,
    segment_id: int,
    segments: List[Dict[str, Any]],
    role_memory: List[Dict[str, Any]],
    provider: str = "heuristic_fallback",
    reason_prefix: str = "",
) -> VisionAiResult:
    seg = selected_segment_metadata(segments, segment_id)
    role = normalize_role_id(seg.get("role_id") or seg.get("role_guess") or "object")
    fallback_color = seg.get("color_hex") or seg.get("suggested_color") or seg.get("assigned_color") or ROLE_DEFAULT_COLORS.get(role, "#3B82F6")
    color = role_memory_color(role_memory, role, str(fallback_color))
    try:
        conf = float(seg.get("confidence") or 0.55)
    except Exception:
        conf = 0.55
    reason = reason_prefix or f"Suggested from CV segment metadata and user-confirmed Role Memory. role_guess={role}"
    return VisionAiResult(
        ok=True,
        provider=provider,
        segment_id=int(segment_id),
        role_id=role,
        color_hex=normalize_hex_color(color, "#3B82F6"),
        confidence=max(0.35, min(0.85, conf)),
        reason=reason,
        raw_response={"segment": seg},
    )


def compact_segments(segments: List[Dict[str, Any]], limit: int = 120) -> List[Dict[str, Any]]:
    out = []
    for s in (segments or [])[:limit]:
        out.append({
            "segment_id": s.get("segment_id"),
            "bbox": s.get("bbox"),
            "centroid": s.get("centroid"),
            "area_ratio": s.get("area_ratio"),
            "role_guess": s.get("role_guess"),
            "assigned_color": s.get("assigned_color") or s.get("color_hex"),
            "confidence": s.get("confidence"),
        })
    return out


def compact_role_memory(role_memory: List[Dict[str, Any]], limit: int = 80) -> List[Dict[str, Any]]:
    items = []
    for r in role_memory or []:
        if r.get("locked_color"):
            items.append({
                "role_id": str(r.get("role_id") or "unknown"),
                "locked_color": normalize_hex_color(r.get("locked_color"), "#3B82F6"),
                "priority": int(r.get("priority") or 0),
            })
    items.sort(key=lambda x: x["priority"], reverse=True)
    return items[:limit]


def make_vision_context_png(
    *,
    selected_segment_id: int,
    selected_segment: Dict[str, Any],
    line_bytes: Optional[bytes] = None,
    colorized_bytes: Optional[bytes] = None,
    segment_ids_bytes: Optional[bytes] = None,
    reference_bytes: Optional[bytes] = None,
    max_panel_width: int = 512,
) -> Tuple[bytes, str]:
    """Create one compact context image for Nova.

    The panel keeps the selected segment visible, but still includes enough global
    context for role recognition. The model is asked to return text JSON only.
    """
    panels: List[Tuple[str, Image.Image]] = []

    def open_image(data: Optional[bytes]) -> Optional[Image.Image]:
        if not data:
            return None
        try:
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception:
            return None

    for title, data in [
        ("segment ids", segment_ids_bytes),
        ("current colorized", colorized_bytes),
        ("current lineart", line_bytes),
        ("trusted reference", reference_bytes),
    ]:
        im = open_image(data)
        if im is not None:
            panels.append((title, im))

    if not panels:
        raise ValueError("No usable image bytes for Vision AI")

    # Use selected bbox if available to draw a rectangle on same-coordinate panels.
    bbox = selected_segment.get("bbox") or []
    rect = None
    if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
        try:
            x, y, w, h = [float(v) for v in bbox]
            rect = (x, y, x + w, y + h)
        except Exception:
            rect = None

    processed = []
    for title, im in panels[:4]:
        original_w, original_h = im.size
        scale = min(1.0, max_panel_width / max(1, original_w))
        new_size = (max(1, int(original_w * scale)), max(1, int(original_h * scale)))
        if scale != 1.0:
            im = im.resize(new_size, Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(im)
        if rect is not None and title != "trusted reference":
            rx1, ry1, rx2, ry2 = [int(v * scale) for v in rect]
            for pad in range(3):
                draw.rectangle([rx1 - pad, ry1 - pad, rx2 + pad, ry2 + pad], outline=(255, 0, 0))
            draw.text((max(0, rx1), max(0, ry1 - 18)), f"selected #{selected_segment_id}", fill=(255, 0, 0))
        processed.append((title, im))

    label_h = 28
    gap = 10
    w = max(im.size[0] for _, im in processed)
    h = sum(im.size[1] + label_h for _, im in processed) + gap * (len(processed) - 1)
    canvas = Image.new("RGB", (w, h), "white")
    draw = ImageDraw.Draw(canvas)
    y = 0
    for title, im in processed:
        draw.rectangle([0, y, w, y + label_h], fill=(245, 245, 245))
        draw.text((8, y + 7), title, fill=(20, 20, 20))
        y += label_h
        canvas.paste(im, (0, y))
        y += im.size[1] + gap

    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue(), "png"


def invoke_nova_json(*, image_bytes: bytes, image_format: str, prompt: str) -> Tuple[Dict[str, Any], str, str]:
    if boto3 is None:
        raise RuntimeError("boto3 is not installed")

    model_id = os.getenv("BEDROCK_VISION_MODEL_ID", "us.amazon.nova-lite-v1:0").strip()
    region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1")).strip()
    client = boto3.client("bedrock-runtime", region_name=region)

    body = {
        "schemaVersion": "messages-v1",
        "system": [{"text": "Return compact valid JSON only. No markdown, no extra commentary."}],
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": image_format,
                            "source": {"bytes": base64.b64encode(image_bytes).decode("utf-8")},
                        }
                    },
                    {"text": prompt},
                ],
            }
        ],
        "inferenceConfig": {"maxTokens": 400, "temperature": 0.1, "topP": 0.1},
    }

    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json",
    )
    model_response = json.loads(response["body"].read())
    text = model_response.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")
    return model_response, text, model_id


def suggest_segment_role_color(
    *,
    segment_id: int,
    segments: List[Dict[str, Any]],
    role_memory: List[Dict[str, Any]],
    line_bytes: Optional[bytes] = None,
    colorized_bytes: Optional[bytes] = None,
    segment_ids_bytes: Optional[bytes] = None,
    reference_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    if not bedrock_enabled():
        return heuristic_suggest(
            segment_id=segment_id,
            segments=segments,
            role_memory=role_memory,
            reason_prefix="Bedrock Vision disabled; using CV heuristic + Role Memory suggestion.",
        ).to_dict()

    try:
        selected_segment = selected_segment_metadata(segments, segment_id)
        context_png, image_format = make_vision_context_png(
            selected_segment_id=segment_id,
            selected_segment=selected_segment,
            line_bytes=line_bytes,
            colorized_bytes=colorized_bytes,
            segment_ids_bytes=segment_ids_bytes,
            reference_bytes=reference_bytes,
        )

        memory = compact_role_memory(role_memory)
        short_segments = compact_segments(segments)
        prompt = f"""
You are the Vision Suggest assistant for FrameFlow.
FrameFlow's CV engine already colorizes the image. You must NOT generate, edit, recolor, or change any image.
Your only task is to inspect the provided context image and metadata, then suggest the semantic role and color for selected segment_id={segment_id}.

Rules:
1. Return ONLY JSON with exactly these keys: role_id, color_hex, confidence, reason.
2. role_id must be one of: {", ".join(ALLOWED_ROLES)}.
3. color_hex must be a 6-digit hex color like #AABBCC.
4. If Role Memory contains the same role, prefer its locked_color.
5. If uncertain, use role_id="unknown" or "object" and confidence below 0.65.
6. Keep the reason short. Mention that this is a suggestion for user confirmation.

Selected segment metadata:
{json.dumps(selected_segment, ensure_ascii=False)}

All visible segment metadata:
{json.dumps(short_segments, ensure_ascii=False)}

User-confirmed Role Memory:
{json.dumps(memory, ensure_ascii=False)}
""".strip()

        model_response, text, model_id = invoke_nova_json(image_bytes=context_png, image_format=image_format, prompt=prompt)
        parsed = extract_json_object(text)
        role = normalize_role_id(parsed.get("role_id") or parsed.get("role") or "unknown")
        fallback_color = role_memory_color(role_memory, role, ROLE_DEFAULT_COLORS.get(role, "#3B82F6"))
        color = normalize_hex_color(parsed.get("color_hex"), fallback_color)
        try:
            conf = float(parsed.get("confidence") or 0.65)
        except Exception:
            conf = 0.65

        return VisionAiResult(
            ok=True,
            provider="amazon_bedrock_nova",
            model_id=model_id,
            segment_id=int(segment_id),
            role_id=role,
            color_hex=color,
            confidence=max(0.0, min(1.0, conf)),
            reason=str(parsed.get("reason") or "Amazon Nova suggested semantic role/color; user confirmation required."),
            raw_response={"model_text": text, "model_response": model_response},
        ).to_dict()
    except Exception as exc:
        return heuristic_suggest(
            segment_id=segment_id,
            segments=segments,
            role_memory=role_memory,
            provider="heuristic_after_bedrock_error",
            reason_prefix=f"Bedrock Vision failed; fallback used: {exc}",
        ).to_dict()
