FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY frameflow_cv_service.py .
COPY vision_ai_service.py .

EXPOSE 8080

CMD ["sh", "-c", "uvicorn frameflow_cv_service:app --host 0.0.0.0 --port ${PORT:-8080}"]