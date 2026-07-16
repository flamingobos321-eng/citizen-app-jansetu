FROM python:3.12-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user (security hardening) ───────────────────────────────────────
RUN groupadd -r jansetu && useradd -r -g jansetu -d /app -s /sbin/nologin jansetu

WORKDIR /app

# ── Python dependencies (cached layer — only re-runs when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# Ensure the uploads directory exists and is writable
RUN mkdir -p /var/data/jansetu/uploads && \
    chown -R jansetu:jansetu /app /var/data/jansetu

USER jansetu

EXPOSE 8000

# ── Health check (Docker and docker-compose use this) ────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=5)"

# ── Start server ──────────────────────────────────────────────────────────────
# Workers = env var WORKERS (default 2). Use at least 2 for zero-downtime reload.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2}"]
