# JANSETU — Constituency Management Platform

## Project Overview

JANSETU is a constituency management platform for elected representatives and their staff. It handles citizen registration, issue tracking, development work, household/family management, karyakarta networks, and push notifications.

### Stack
- **Backend**: Python 3.12, FastAPI, MongoDB (Motor async driver), JWT auth
- **Frontend**: React (Create React App), Tailwind CSS, shadcn/ui components
- **Mobile**: Capacitor (Android support)
- **Storage**: S3-compatible object storage
- **Notifications**: Firebase Cloud Messaging

### Key backend files
- `backend/server.py` — main FastAPI app entry point
- `backend/models.py` — Pydantic models
- `backend/otp_service.py` — OTP authentication
- `backend/push_service.py` — Firebase push notifications
- `backend/electoral_parser.py` — Electoral roll import

### Key frontend files
- `frontend/src/pages/` — page components
- `frontend/src/components/` — shared UI components

## Running the Project

Two workflows are configured and start the app:
- **Backend API** — FastAPI on port 8000 (`cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload`)
- **Start application** — React on port 5000 (webview preview)

The frontend proxies `/api/*` requests to `http://localhost:8000` via the `"proxy"` field in `frontend/package.json`. `REACT_APP_BACKEND_URL` is set to `""` so relative URLs are used in dev.

### Required secrets (set in Replit Secrets)
- `MONGO_URL` — MongoDB connection string (Atlas or self-hosted)
- `JWT_SECRET` — secret for signing JWT login tokens

### Required env vars (set in Replit)
- `DB_NAME=jansetu` — MongoDB database name
- `PORT=5000` — frontend dev server port
- `DANGEROUSLY_DISABLE_HOST_CHECK=true` — required for Replit proxy

### Optional / service credentials
- `backend/secrets/firebase-admin.json` — Firebase service account for push notifications
- S3 / object storage credentials (for file uploads) — see Task #6

### Post-merge script
`scripts/post-merge.sh` — installs Python deps (`backend/requirements.txt`) and Node deps (`frontend/`) after every task merge.

## User Preferences
