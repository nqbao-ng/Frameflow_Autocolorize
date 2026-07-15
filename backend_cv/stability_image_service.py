#!/usr/bin/env python3
"""Amazon Bedrock adapter for Stability AI Image Services used by FrameFlow."""

from __future__ import annotations

import base64
import io
import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from PIL import Image

BEDROCK_REGION = (
    os.getenv("FRAMEFLOW_STABILITY_BEDROCK_REGION")
    or os.getenv("BEDROCK_STABILITY_REGION")
    or "us-east-1"
).strip()

CONTROL_SKETCH_MODEL_ID = (
    os.getenv("FRAMEFLOW_STABILITY_CONTROL_SKETCH_MODEL_ID")
    or "us.stability.stable-image-control-sketch-v1:0"
).strip()

OUTPAINT_MODEL_ID = (
    os.getenv("FRAMEFLOW_STABILITY_OUTPAINT_MODEL_ID")
    or "us.stability.stable-outpaint-v1:0"
).strip()

MAX_IMAGE_BYTES = int(os.getenv("FRAMEFLOW_STABILITY_MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))
MAX_IMAGE_PIXELS = 9_437_184
ALLOWED_FORMATS = {"PNG": "png", "JPEG": "jpeg", "WEBP": "webp"}
ALLOWED_STYLE_PRESETS = {
    "3d-model",
    "analog-film",
    "anime",
    "cinematic",
    "comic-book",
    "digital-art",
    "enhance",
    "fantasy-art",
    "isometric",
    "line-art",
    "low-poly",
    "modeling-compound",
    "neon-punk",
    "origami",
    "photographic",
    "pixel-art",
    "tile-texture",
}


class StabilityImageServiceError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502, details: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or message


@lru_cache(maxsize=1)
def get_bedrock_client():
    return boto3.client(
        "bedrock-runtime",
        region_name=BEDROCK_REGION,
        config=Config(
            connect_timeout=8,
            read_timeout=45,
            retries={"max_attempts": 1, "mode": "standard"},
        ),
    )


def service_status() -> Dict[str, Any]:
    """Return non-secret configuration and whether AWS credentials are resolvable."""
    try:
        credentials_available = boto3.Session().get_credentials() is not None
    except Exception:
        credentials_available = False

    return {
        "ok": credentials_available,
        "provider": "amazon-bedrock",
        "service": "stability-ai-image-services",
        "region": BEDROCK_REGION,
        "models": {
            "control_sketch": CONTROL_SKETCH_MODEL_ID,
            "outpaint": OUTPAINT_MODEL_ID,
        },
        "authentication": "ecs-task-role",
        "credentials_available": credentials_available,
        "detail": None if credentials_available else "AWS credentials were not found. Attach the Bedrock IAM Task Role to the ECS task.",
    }


def validate_image_base64(image_base64: str) -> str:
    value = str(image_base64 or "").strip()
    if not value:
        raise StabilityImageServiceError("image_base64 is required", 400)

    try:
        raw = base64.b64decode(value, validate=True)
    except Exception as exc:
        raise StabilityImageServiceError("Invalid Base64 image", 400) from exc

    if not raw:
        raise StabilityImageServiceError("Image is empty", 400)
    if len(raw) > MAX_IMAGE_BYTES:
        raise StabilityImageServiceError("Image exceeds the backend size limit", 413)

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image_format = str(image.format or "").upper()
            width, height = image.size
            image.verify()
    except Exception as exc:
        raise StabilityImageServiceError("Unable to decode the uploaded image", 400) from exc

    if image_format not in ALLOWED_FORMATS:
        raise StabilityImageServiceError("Only PNG, JPEG, and WebP images are supported", 400)
    if width < 64 or height < 64:
        raise StabilityImageServiceError("Each image side must be at least 64 pixels", 400)
    if width * height > MAX_IMAGE_PIXELS:
        raise StabilityImageServiceError("Image exceeds Stability Image Services pixel limit", 400)

    aspect = width / max(1, height)
    if aspect < 0.4 or aspect > 2.5:
        raise StabilityImageServiceError("Image aspect ratio must be between 1:2.5 and 2.5:1", 400)

    return base64.b64encode(raw).decode("ascii")


def _normalize_prompt(value: Optional[str], *, required: bool) -> Optional[str]:
    text = " ".join(str(value or "").split()).strip()
    if required and not text:
        raise StabilityImageServiceError("Prompt is required", 400)
    if len(text) > 10_000:
        raise StabilityImageServiceError("Prompt must not exceed 10,000 characters", 400)
    return text or None


def _normalize_seed(seed: Optional[int]) -> Optional[int]:
    if seed is None:
        return None
    value = int(seed)
    if value < 0 or value > 4_294_967_294:
        raise StabilityImageServiceError("Seed is outside the supported range", 400)
    return value


def _normalize_style_preset(style_preset: Optional[str]) -> Optional[str]:
    value = str(style_preset or "").strip()
    if not value:
        return None
    if value not in ALLOWED_STYLE_PRESETS:
        raise StabilityImageServiceError("Unsupported Stability style preset", 400)
    return value


def _invoke(model_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        response = get_bedrock_client().invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json",
        )
        model_response = json.loads(response["body"].read())
    except NoCredentialsError as exc:
        raise StabilityImageServiceError(
            "AWS credentials are unavailable. Attach the Bedrock IAM Task Role to the ECS task.",
            503,
        ) from exc
    except ClientError as exc:
        error = exc.response.get("Error", {})
        code = str(error.get("Code") or "BedrockClientError")
        message = str(error.get("Message") or exc)
        status = 403 if code in {"AccessDeniedException", "UnauthorizedException"} else 429 if code in {"ThrottlingException", "TooManyRequestsException"} else 502
        raise StabilityImageServiceError(
            f"Amazon Bedrock request failed: {code}",
            status,
            message,
        ) from exc
    except (BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        raise StabilityImageServiceError("Unable to invoke Stability AI through Amazon Bedrock", 502, str(exc)) from exc

    images = model_response.get("images") or []
    finish_reasons = model_response.get("finish_reasons") or []
    seeds = model_response.get("seeds") or []
    finish_reason = finish_reasons[0] if finish_reasons else None

    if finish_reason:
        raise StabilityImageServiceError(
            "Stability AI did not return an image",
            422,
            str(finish_reason),
        )
    if not images or not images[0]:
        raise StabilityImageServiceError("Stability AI returned no image data", 502)

    return {
        "ok": True,
        "image_base64": images[0],
        "mime_type": "image/png",
        "seed": seeds[0] if seeds else None,
        "finish_reason": finish_reason,
        "provider": "amazon-bedrock",
        "model_id": model_id,
        "region": BEDROCK_REGION,
    }


def generate_control_sketch(
    *,
    image_base64: str,
    prompt: str,
    negative_prompt: Optional[str] = None,
    control_strength: float = 0.78,
    style_preset: Optional[str] = None,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "image": validate_image_base64(image_base64),
        "prompt": _normalize_prompt(prompt, required=True),
        "control_strength": min(1.0, max(0.0, float(control_strength))),
        "output_format": "png",
    }

    normalized_negative = _normalize_prompt(negative_prompt, required=False)
    normalized_style = _normalize_style_preset(style_preset)
    normalized_seed = _normalize_seed(seed)
    if normalized_negative:
        payload["negative_prompt"] = normalized_negative
    if normalized_style:
        payload["style_preset"] = normalized_style
    if normalized_seed is not None:
        payload["seed"] = normalized_seed

    return _invoke(CONTROL_SKETCH_MODEL_ID, payload)


def generate_outpaint(
    *,
    image_base64: str,
    prompt: Optional[str] = None,
    left: int = 0,
    right: int = 0,
    up: int = 0,
    down: int = 0,
    creativity: float = 0.5,
    style_preset: Optional[str] = None,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    directions = {
        "left": min(2000, max(0, int(left))),
        "right": min(2000, max(0, int(right))),
        "up": min(2000, max(0, int(up))),
        "down": min(2000, max(0, int(down))),
    }
    if sum(directions.values()) == 0:
        raise StabilityImageServiceError("At least one outpaint direction must be greater than zero", 400)

    payload: Dict[str, Any] = {
        "image": validate_image_base64(image_base64),
        **directions,
        "creativity": min(1.0, max(0.1, float(creativity))),
        "output_format": "png",
    }

    normalized_prompt = _normalize_prompt(prompt, required=False)
    normalized_style = _normalize_style_preset(style_preset)
    normalized_seed = _normalize_seed(seed)
    if normalized_prompt:
        payload["prompt"] = normalized_prompt
    if normalized_style:
        payload["style_preset"] = normalized_style
    if normalized_seed is not None:
        payload["seed"] = normalized_seed

    return _invoke(OUTPAINT_MODEL_ID, payload)
