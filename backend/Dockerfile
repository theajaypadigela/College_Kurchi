# College Kurchi backend — FastAPI + RAG.
# Default (hashing) embeddings need no heavy ML deps, so the image stays slim.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code.
COPY app ./app

# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# Readiness-based container healthcheck (503 until Mongo + index are ready).
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/readiness')" || exit 1

# For production scale, increase workers, e.g.:
#   CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","4"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
