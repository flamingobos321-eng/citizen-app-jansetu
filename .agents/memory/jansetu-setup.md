---
name: Jansetu Replit setup
description: Quirks and decisions made when configuring JANSETU to run on Replit
---

## `emergentintegrations` package unavailable on Replit

The package `emergentintegrations==0.2.0` was in `backend/requirements.txt` but is not on PyPI and is blocked by Replit's package firewall. It was not imported anywhere in the backend code, so it was removed from requirements.txt.

**Why:** Any future requirements update should NOT re-add this package unless a custom index URL is configured.

**How to apply:** If the package is genuinely needed, find its source URL (likely `customer-assets.emergentagent.com`) and install via `pip install <url>` rather than adding it to requirements.txt.

## Frontend `ajv` version conflict

`ajv-keywords@5.x` requires `ajv@^8`, but CRA's transitive deps pull in `ajv@6`. Fixed by running `npm install ajv@^8 --legacy-peer-deps` in `frontend/`. The post-merge script uses `--legacy-peer-deps` for this reason.

## Frontend ↔ backend proxying in dev

`REACT_APP_BACKEND_URL=""` (empty string) makes all API calls use relative URLs (`/api/...`). The CRA dev server's `"proxy": "http://localhost:8000"` in `frontend/package.json` forwards those to the FastAPI backend. Do not hardcode a port or domain in `REACT_APP_BACKEND_URL`.

## Storage init warning is expected

On startup, the backend logs: `Storage init deferred: 400 Client Error`. This is non-fatal — S3/object-store credentials haven't been configured yet (see proposed task for S3). The app runs normally without it.
