# FrameFlow CV Service

Stateless Python service for real FrameFlow colorization:

- preserves original sketch/lineart
- segments fillable white regions with OpenCV
- extracts colors from a trusted colored keyframe
- propagates colors by optical flow + segment feature matching
- returns colorized PNG, low-confidence overlay, segment-id preview, and segment metadata
- optional Amazon Nova Vision suggestion for selected segments

Run locally:

```bash
cd backend_cv
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn frameflow_cv_service:app --host 0.0.0.0 --port 8000 --reload
```

Required env:

```bash
FRAMEFLOW_CV_API_KEY=change_this_secret
```

Optional AWS Bedrock Vision:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_VISION_MODEL_ID=us.amazon.nova-lite-v1:0
FRAMEFLOW_ENABLE_BEDROCK_VISION=true
```
