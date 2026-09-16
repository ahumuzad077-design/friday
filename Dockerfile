FROM python:3.12-slim

WORKDIR /app

COPY requirements-v2.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements-v2.txt

COPY . .

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["sh", "-c", "python -m uvicorn friday_core.api_v2:app --host 0.0.0.0 --port ${PORT:-8000}"]
