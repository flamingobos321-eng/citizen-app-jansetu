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

### Required environment variables (backend)
- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — MongoDB database name
- `JWT_SECRET` — secret for JWT signing

### Optional / service credentials
- `backend/secrets/firebase-admin.json` — Firebase service account for push notifications
- S3 / object storage credentials (for file uploads)

### Start commands
- **Backend**: `cd backend && uvicorn server:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend**: `cd frontend && npm start`

## User Preferences
