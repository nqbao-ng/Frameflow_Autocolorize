"""Amazon Bedrock Nova sketch analysis helper for FrameFlow AI Sketch Studio.

The goal is not to generate an image. Nova only analyzes the uploaded sketch
and returns structured guidance that FrameFlow later combines with a style
template and Stability Control Sketch.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional

from PIL import Image

try:
    import boto3
    from botocore.config import Config
except Exception:  # pragma: no cover - optional until enabled in ECS
    boto3 = None  # type: ignore
    Config = None  # type: ignore

CREATIVE_ANALYSIS_REGION = (
    os.getenv("FRAMEFLOW_CREATIVE_ANALYSIS_BEDROCK_REGION")
    or os.getenv("FRAMEFLOW_VISION_BEDROCK_REGION")
    or os.getenv("AWS_REGION")
    or "us-east-1"
).strip()

CREATIVE_ANALYSIS_MODEL_ID = (
    os.getenv("FRAMEFLOW_CREATIVE_ANALYSIS_MODEL_ID")
    or os.getenv("BEDROCK_CREATIVE_ANALYSIS_MODEL_ID")
    or os.getenv("BEDROCK_VISION_MODEL_ID")
    or "us.amazon.nova-lite-v1:0"
).strip()


def creative_analysis_enabled() -> bool:
    flag = os.getenv("FRAMEFLOW_ENABLE_BEDROCK_CREATIVE_ANALYSIS", "").strip().lower()
    if flag in {"true", "1", "yes"}:
        return boto3 is not None
    return os.getenv("FRAMEFLOW_ENABLE_BEDROCK_VISION", "false").strip().lower() == "true" and boto3 is not None


class SketchAnalysisServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502, details: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or message


STYLE_DEFAULTS: Dict[str, Dict[str, str]] = {
    "anime": {
        "palette": "Soft vibrant anime palette with balanced skin tones, appealing hair color contrast, and clean cel-shaded color blocking.",
        "environment": "Keep the background simple and clean so the main character remains the focus.",
        "lighting": "Soft even daylight with gentle cel shading.",
        "mood": "Expressive and polished.",
    },
    "webtoon": {
        "palette": "Clean webtoon palette with readable local colors, subtle gradients, and crisp separation between elements.",
        "environment": "Simple illustrated background with enough context for a vertical comic panel.",
        "lighting": "Soft studio-like lighting with restrained shading.",
        "mood": "Clear, stylish, and approachable.",
    },
    "manga": {
        "palette": "Controlled manga color palette with clean flats and tasteful accents.",
        "environment": "Minimal background treatment that supports the character design without clutter.",
        "lighting": "Soft editorial lighting with limited shadow complexity.",
        "mood": "Refined and illustrative.",
    },
    "anime90": {
        "palette": "Warm nostalgic cel-animation palette with slightly muted classic anime colors.",
        "environment": "Simple classic animation background treatment.",
        "lighting": "Warm and gentle lighting reminiscent of hand-painted cel animation.",
        "mood": "Nostalgic and charming.",
    },
    "chibi": {
        "palette": "Cute high-clarity palette with bright friendly colors and soft pastels.",
        "environment": "Minimal playful background.",
        "lighting": "Bright soft lighting with minimal shadows.",
        "mood": "Cute, cheerful, and light.",
    },
    "cinematic": {
        "palette": "Cinematic animation palette with deliberate color contrast and a polished concept-art feel.",
        "environment": "Background can include simple atmospheric context while staying clean and readable.",
        "lighting": "Soft directional lighting with tasteful depth, but not photorealistic.",
        "mood": "Atmospheric and story-driven.",
    },
}


@lru_cache(maxsize=1)
def get_bedrock_client():
    if boto3 is None:
        raise SketchAnalysisServiceError("boto3 is not available", 503)
    return boto3.client(
        "bedrock-runtime",
        region_name=CREATIVE_ANALYSIS_REGION,
        config=Config(
            connect_timeout=5,
            read_timeout=25,
            retries={"max_attempts": 1, "mode": "standard"},
        ),
    )



def _decode_image(image_base64: str) -> bytes:
    value = str(image_base64 or "").strip()
    if not value:
        raise SketchAnalysisServiceError("image_base64 is required", 400)
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception as exc:
        raise SketchAnalysisServiceError("Invalid Base64 image", 400) from exc
    if not raw:
        raise SketchAnalysisServiceError("Image is empty", 400)
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()
    except Exception as exc:
        raise SketchAnalysisServiceError("Unable to decode the uploaded image", 400) from exc
    return raw



def _image_format(raw: bytes) -> str:
    try:
        with Image.open(io.BytesIO(raw)) as image:
            fmt = str(image.format or "PNG").lower()
    except Exception:
        fmt = "png"
    return "jpeg" if fmt == "jpg" else (fmt if fmt in {"png", "jpeg", "webp", "gif"} else "png")



def _extract_json(text: str) -> Dict[str, Any]:
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
    raise ValueError("No JSON object found in model output")



def _normalize_list(value: Any, fallback: Optional[List[str]] = None) -> List[str]:
    if isinstance(value, list):
        items = [" ".join(str(item).split()).strip() for item in value]
        items = [item for item in items if item]
        if items:
            return items[:12]
    return list(fallback or [])



def _normalize_text(value: Any, fallback: str) -> str:
    text = " ".join(str(value or "").split()).strip()
    return text or fallback



def fallback_analysis(style_hint: Optional[str] = None) -> Dict[str, Any]:
    style_key = str(style_hint or "anime").strip().lower()
    defaults = STYLE_DEFAULTS.get(style_key, STYLE_DEFAULTS["anime"])
    return {
        "ok": True,
        "provider": "frameflow_fallback",
        "model_id": None,
        "subject": "The uploaded image appears to be a hand-drawn character or scene sketch.",
        "composition": "Preserve the original composition, proportions, pose, and placement of the main elements from the sketch.",
        "preserve_details": [
            "Keep the recognizable silhouette and structure of the main subject",
            "Preserve important facial or object-defining details visible in the sketch",
            "Maintain the original pose and general composition",
        ],
        "suggested_palette": defaults["palette"],
        "environment": defaults["environment"],
        "lighting": defaults["lighting"],
        "mood": defaults["mood"],
        "confidence": 0.45,
        "uncertain_details": [
            "The exact colors and artistic intent could not be determined automatically.",
        ],
    }



def analyze_sketch(*, image_base64: str, style_hint: Optional[str] = None) -> Dict[str, Any]:
    raw = _decode_image(image_base64)

    if not creative_analysis_enabled():
        return fallback_analysis(style_hint)

    prompt = (
        "You are analyzing a rough drawing or lineart sketch for a creative app. "
        "Describe only what is clearly visible in the sketch and provide practical, concise guidance for generating a clean colored concept illustration. "
        "Do not mention any copyrighted franchise names. If something is uncertain, state that uncertainty instead of inventing facts. "
        "Return JSON only using this schema: "
        "{"
        '"subject": string, '
        '"composition": string, '
        '"preserve_details": string[], '
        '"suggested_palette": string, '
        '"environment": string, '
        '"lighting": string, '
        '"mood": string, '
        '"confidence": number, '
        '"uncertain_details": string[]'
        "}. "
        f"The selected visual style hint is: {style_hint or 'anime'}."
    )

    try:
        response = get_bedrock_client().converse(
            modelId=CREATIVE_ANALYSIS_MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"text": prompt},
                        {
                            "image": {
                                "format": _image_format(raw),
                                "source": {"bytes": raw},
                            }
                        },
                    ],
                }
            ],
            inferenceConfig={"temperature": 0.2, "maxTokens": 700},
        )
    except Exception as exc:
        return {
            **fallback_analysis(style_hint),
            "provider": "frameflow_fallback_after_nova_error",
            "uncertain_details": [f"Nova analysis was unavailable: {exc}"],
        }

    try:
        blocks = response.get("output", {}).get("message", {}).get("content", [])
        text_parts = [block.get("text", "") for block in blocks if isinstance(block, dict) and block.get("text")]
        parsed = _extract_json("\n".join(text_parts))
    except Exception as exc:
        return {
            **fallback_analysis(style_hint),
            "provider": "frameflow_fallback_after_parse_error",
            "uncertain_details": [f"Nova returned an unexpected format: {exc}"],
        }

    defaults = STYLE_DEFAULTS.get(str(style_hint or "anime").strip().lower(), STYLE_DEFAULTS["anime"])

    confidence_raw = parsed.get("confidence", 0.65)
    try:
        confidence = float(confidence_raw)
    except Exception:
        confidence = 0.65
    confidence = max(0.0, min(1.0, confidence))

    return {
        "ok": True,
        "provider": "amazon_bedrock_nova",
        "model_id": CREATIVE_ANALYSIS_MODEL_ID,
        "subject": _normalize_text(parsed.get("subject"), fallback_analysis(style_hint)["subject"]),
        "composition": _normalize_text(parsed.get("composition"), fallback_analysis(style_hint)["composition"]),
        "preserve_details": _normalize_list(parsed.get("preserve_details"), fallback_analysis(style_hint)["preserve_details"]),
        "suggested_palette": _normalize_text(parsed.get("suggested_palette"), defaults["palette"]),
        "environment": _normalize_text(parsed.get("environment"), defaults["environment"]),
        "lighting": _normalize_text(parsed.get("lighting"), defaults["lighting"]),
        "mood": _normalize_text(parsed.get("mood"), defaults["mood"]),
        "confidence": confidence,
        "uncertain_details": _normalize_list(parsed.get("uncertain_details"), []),
    }
