---
name: Jansetu Replit setup
description: Quirks and decisions made when configuring JANSETU to run on Replit, and Emergent de-coupling work
---

## `emergentintegrations` package unavailable on Replit

Removed from `backend/requirements.txt` — not imported anywhere in the backend code.

**Why:** Not on PyPI and blocked by Replit's package firewall.

## Frontend `ajv` version conflict

`ajv-keywords@5.x` requires `ajv@^8`, but CRA transitive deps pull in `ajv@6`. Fixed by running `npm install ajv@^8 --legacy-peer-deps` in `frontend/`. Post-merge script uses `--legacy-peer-deps`.

## Frontend ↔ backend proxying in dev

`REACT_APP_BACKEND_URL=""` (empty string) makes API calls relative (`/api/...`). CRA dev server `"proxy": "http://localhost:8000"` in `frontend/package.json` forwards those to FastAPI. Do not hardcode a domain in `REACT_APP_BACKEND_URL`.

## Emergent de-coupling (completed)

All Emergent platform dependencies removed:
- `storage_util.py` rewritten to use boto3 / S3-compatible storage (env vars: `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, optionally `S3_ENDPOINT_URL` for MinIO).
- `litellm` custom wheel URL replaced with standard PyPI `litellm==1.80.0`.
- `@emergentbase/visual-edits` removed from `frontend/package.json` and `craco.config.js`.
- `frontend/public/index.html` cleaned: title, meta description, Emergent badge, emergent-main.js, and PostHog (Emergent's account) all removed.
- Test file `BASE_URL` defaults changed from `emergentagent.com` preview to `http://localhost:8000`; env var key changed from `REACT_APP_BACKEND_URL` to `BACKEND_URL` for test scripts.

## Docker Compose VPS deployment

Production stack for Hostinger VPS (Ubuntu 24.04):
- `backend/Dockerfile` — Python 3.12-slim, uvicorn
- `frontend/Dockerfile` — Node 20 build → Nginx 1.27 serve
- `frontend/nginx.conf` — serves React SPA, proxies `/api` → `http://backend:8000`, SSL via Let's Encrypt mount
- `docker-compose.yml` — services: mongodb, backend, frontend; MongoDB bound to 127.0.0.1 only
- `.env.example` — template; real `.env` must never be committed
- `DEPLOY.md` — step-by-step VPS deployment guide including Certbot SSL setup

**Why REACT_APP_BACKEND_URL="" in production:** The frontend Dockerfile builds with empty REACT_APP_BACKEND_URL so all API calls are relative (/api/...). Nginx in the same container proxies those to the backend container. No hardcoded domain needed in the build.
