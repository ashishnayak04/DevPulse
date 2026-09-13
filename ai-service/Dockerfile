# syntax=docker/dockerfile:1
# DevPulse AI service image: Python/FastAPI reasoning layer. Reachable by the
# backend over HTTP (AI_SERVICE_URL); it calls back into the Node API with a
# shared service token (AI_SERVICE_TOKEN) instead of touching the database.
FROM python:3.11-slim AS ai

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY ai-service/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ai-service/app/ app/

EXPOSE 8000

# NODE_API_URL is the base URL the AI tools use to fetch scoped context.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${AI_SERVICE_PORT:-8000}"]