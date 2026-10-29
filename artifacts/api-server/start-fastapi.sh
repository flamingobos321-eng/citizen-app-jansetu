#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../backend"
: "${PORT:?The artifact workflow must supply PORT}"
# The existing startup hooks seed/backfill data and create indexes.
# Preview deliberately skips them, so opening this port cannot migrate MongoDB.
# Production continues to use backend/Dockerfile and its original lifecycle.
if [[ "${1:-preview}" == "production" ]]; then
  exec python -m uvicorn server:app --host 0.0.0.0 --port "$PORT"
fi
exec python -m uvicorn server:app --host 0.0.0.0 --port "$PORT" --lifespan off
