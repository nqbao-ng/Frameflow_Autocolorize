"""SQS-backed asynchronous Creative Studio worker for FrameFlow.

The Vercel API uploads source images to a private Supabase Storage bucket,
creates a creative_jobs row, and asks the ECS service to enqueue only the job id.
This worker polls SQS, invokes Stability AI through Amazon Bedrock, uploads the
result back to Supabase Storage, and updates the job row.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import quote

import boto3
import requests

from stability_image_service import (
    StabilityImageServiceError,
    generate_control_sketch,
    generate_outpaint,
)

LOGGER = logging.getLogger("frameflow.creative_worker")

SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
CREATIVE_QUEUE_URL = os.getenv("FRAMEFLOW_CREATIVE_QUEUE_URL", "").strip()
CREATIVE_QUEUE_REGION = (
    os.getenv("FRAMEFLOW_CREATIVE_QUEUE_REGION")
    or os.getenv("AWS_REGION")
    or os.getenv("AWS_DEFAULT_REGION")
    or "ap-southeast-1"
).strip()
CREATIVE_WORKER_ENABLED = os.getenv("FRAMEFLOW_ENABLE_CREATIVE_WORKER", "false").strip().lower() in {
    "true",
    "1",
    "yes",
}
CREATIVE_VISIBILITY_TIMEOUT = int(os.getenv("FRAMEFLOW_CREATIVE_VISIBILITY_TIMEOUT", "180"))
CREATIVE_MAX_ATTEMPTS = int(os.getenv("FRAMEFLOW_CREATIVE_MAX_ATTEMPTS", "3"))
CREATIVE_POLL_WAIT_SECONDS = min(20, max(1, int(os.getenv("FRAMEFLOW_CREATIVE_POLL_WAIT_SECONDS", "20"))))
CREATIVE_BUCKET = os.getenv("FRAMEFLOW_CREATIVE_BUCKET", "creative-assets").strip() or "creative-assets"

_worker_thread: Optional[threading.Thread] = None
_worker_lock = threading.Lock()
_stop_event = threading.Event()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def worker_status() -> Dict[str, Any]:
    return {
        "enabled": CREATIVE_WORKER_ENABLED,
        "queue_configured": bool(CREATIVE_QUEUE_URL),
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY),
        "running": bool(_worker_thread and _worker_thread.is_alive()),
        "queue_region": CREATIVE_QUEUE_REGION,
        "max_attempts": CREATIVE_MAX_ATTEMPTS,
        "visibility_timeout": CREATIVE_VISIBILITY_TIMEOUT,
    }


def _require_configuration() -> None:
    missing = []
    if not CREATIVE_QUEUE_URL:
        missing.append("FRAMEFLOW_CREATIVE_QUEUE_URL")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing:
        raise RuntimeError(f"Missing creative worker configuration: {', '.join(missing)}")


def _headers(*, json_content: bool = True, prefer: Optional[str] = None) -> Dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    if json_content:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    return headers


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/creative_jobs",
        params={"id": f"eq.{job_id}", "select": "*", "limit": "1"},
        headers=_headers(json_content=False),
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json() or []
    return rows[0] if rows else None


def update_job(job_id: str, values: Dict[str, Any], *, statuses: Optional[list[str]] = None) -> Optional[Dict[str, Any]]:
    params: Dict[str, str] = {"id": f"eq.{job_id}"}
    if statuses:
        encoded = ",".join(statuses)
        params["status"] = f"in.({encoded})"
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/creative_jobs",
        params=params,
        headers=_headers(prefer="return=representation"),
        data=json.dumps(values),
        timeout=20,
    )
    response.raise_for_status()
    rows = response.json() or []
    return rows[0] if rows else None


def download_storage_object(bucket: str, path: str) -> bytes:
    encoded_path = quote(path, safe="/")
    response = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}",
        headers=_headers(json_content=False),
        timeout=40,
    )
    response.raise_for_status()
    return response.content


def upload_storage_object(bucket: str, path: str, data: bytes, content_type: str = "image/png") -> None:
    encoded_path = quote(path, safe="/")
    headers = _headers(json_content=False)
    headers.update({
        "Content-Type": content_type,
        "x-upsert": "true",
        "Cache-Control": "3600",
    })
    response = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}",
        headers=headers,
        data=data,
        timeout=40,
    )
    if response.status_code == 409:
        response = requests.put(
            f"{SUPABASE_URL}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}",
            headers=headers,
            data=data,
            timeout=40,
        )
    response.raise_for_status()


def enqueue_job(job_id: str) -> Dict[str, Any]:
    _require_configuration()
    sqs = boto3.client("sqs", region_name=CREATIVE_QUEUE_REGION)
    response = sqs.send_message(
        QueueUrl=CREATIVE_QUEUE_URL,
        MessageBody=json.dumps({"job_id": job_id}),
        MessageAttributes={
            "job_type": {
                "DataType": "String",
                "StringValue": "frameflow_creative_job",
            }
        },
    )
    return {
        "ok": True,
        "job_id": job_id,
        "message_id": response.get("MessageId"),
        "queue_region": CREATIVE_QUEUE_REGION,
    }


def _result_path(job: Dict[str, Any]) -> str:
    return f"{job['user_id']}/{job['id']}/result.png"


def _is_cancelled(job_id: str) -> bool:
    latest = get_job(job_id)
    return not latest or latest.get("status") == "cancelled"


def _invoke_job(job: Dict[str, Any]) -> Dict[str, Any]:
    source = download_storage_object(job["source_bucket"], job["source_path"])
    image_base64 = base64.b64encode(source).decode("ascii")
    settings = job.get("settings") or {}

    if job.get("job_type") == "outpaint":
        return generate_outpaint(
            image_base64=image_base64,
            prompt=job.get("prompt"),
            left=int(settings.get("left") or 0),
            right=int(settings.get("right") or 0),
            up=int(settings.get("up") or 0),
            down=int(settings.get("down") or 0),
            creativity=float(settings.get("creativity") or 0.45),
            style_preset=settings.get("style_preset"),
            seed=settings.get("seed"),
        )

    return generate_control_sketch(
        image_base64=image_base64,
        prompt=str(job.get("prompt") or ""),
        negative_prompt=job.get("negative_prompt"),
        control_strength=float(settings.get("control_strength") or 0.9),
        style_preset=settings.get("style_preset"),
        seed=settings.get("seed"),
    )


def _retryable(error: Exception) -> bool:
    if isinstance(error, StabilityImageServiceError):
        return error.status_code in {429, 500, 502, 503, 504}
    if isinstance(error, (requests.Timeout, requests.ConnectionError)):
        return True
    return False


def process_job(job_id: str, receive_count: int = 1) -> str:
    """Process one job and return one of: delete, retry, ignore."""
    job = get_job(job_id)
    if not job:
        return "delete"
    if job.get("status") in {"completed", "failed", "cancelled"}:
        return "delete"

    attempts = max(int(job.get("attempt_count") or 0) + 1, receive_count)
    claimed = update_job(
        job_id,
        {
            "status": "processing",
            "progress": 20,
            "attempt_count": attempts,
            "started_at": job.get("started_at") or utc_now(),
            "error_message": None,
        },
        statuses=["queued", "processing"],
    )
    if not claimed:
        return "ignore"

    try:
        result = _invoke_job(claimed)
        if _is_cancelled(job_id):
            return "delete"

        update_job(job_id, {"progress": 75}, statuses=["processing"])
        result_bytes = base64.b64decode(result["image_base64"])
        result_path = _result_path(claimed)
        upload_storage_object(CREATIVE_BUCKET, result_path, result_bytes, result.get("mime_type") or "image/png")

        if _is_cancelled(job_id):
            return "delete"

        update_job(
            job_id,
            {
                "status": "completed",
                "progress": 100,
                "result_bucket": CREATIVE_BUCKET,
                "result_path": result_path,
                "provider": result.get("provider") or "amazon-bedrock",
                "model_id": result.get("model_id"),
                "seed": str(result.get("seed")) if result.get("seed") is not None else None,
                "error_message": None,
                "completed_at": utc_now(),
                "metadata": {
                    **(claimed.get("metadata") or {}),
                    "finish_reason": result.get("finish_reason"),
                    "region": result.get("region"),
                },
            },
            statuses=["processing"],
        )
        return "delete"
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Creative job %s failed on attempt %s", job_id, attempts)
        message = getattr(exc, "details", None) or str(exc)
        if attempts < CREATIVE_MAX_ATTEMPTS and _retryable(exc):
            update_job(
                job_id,
                {
                    "status": "queued",
                    "progress": 5,
                    "error_message": f"Retrying after attempt {attempts}: {message}",
                },
                statuses=["processing"],
            )
            return "retry"

        update_job(
            job_id,
            {
                "status": "failed",
                "progress": 0,
                "error_message": message[:4000],
                "completed_at": utc_now(),
            },
            statuses=["processing", "queued"],
        )
        return "delete"


def _worker_loop() -> None:
    try:
        _require_configuration()
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("Creative worker disabled: %s", exc)
        return

    sqs = boto3.client("sqs", region_name=CREATIVE_QUEUE_REGION)
    LOGGER.info("Creative worker started in %s", CREATIVE_QUEUE_REGION)

    while not _stop_event.is_set():
        try:
            response = sqs.receive_message(
                QueueUrl=CREATIVE_QUEUE_URL,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=CREATIVE_POLL_WAIT_SECONDS,
                VisibilityTimeout=CREATIVE_VISIBILITY_TIMEOUT,
                AttributeNames=["ApproximateReceiveCount"],
            )
            messages = response.get("Messages") or []
            if not messages:
                continue

            for message in messages:
                receipt = message["ReceiptHandle"]
                try:
                    body = json.loads(message.get("Body") or "{}")
                    job_id = str(body.get("job_id") or "").strip()
                    if not job_id:
                        sqs.delete_message(QueueUrl=CREATIVE_QUEUE_URL, ReceiptHandle=receipt)
                        continue
                    receive_count = int((message.get("Attributes") or {}).get("ApproximateReceiveCount") or 1)
                    action = process_job(job_id, receive_count)
                    if action == "delete":
                        sqs.delete_message(QueueUrl=CREATIVE_QUEUE_URL, ReceiptHandle=receipt)
                    elif action == "retry":
                        delay = min(300, 20 * receive_count)
                        sqs.change_message_visibility(
                            QueueUrl=CREATIVE_QUEUE_URL,
                            ReceiptHandle=receipt,
                            VisibilityTimeout=delay,
                        )
                except Exception:  # noqa: BLE001
                    LOGGER.exception("Unexpected error while handling an SQS message")
        except Exception:  # noqa: BLE001
            LOGGER.exception("Creative worker polling failed")
            time.sleep(5)


def start_worker() -> bool:
    global _worker_thread
    if not CREATIVE_WORKER_ENABLED:
        return False
    with _worker_lock:
        if _worker_thread and _worker_thread.is_alive():
            return True
        _stop_event.clear()
        _worker_thread = threading.Thread(
            target=_worker_loop,
            name="frameflow-creative-worker",
            daemon=True,
        )
        _worker_thread.start()
        return True


def stop_worker() -> None:
    _stop_event.set()
