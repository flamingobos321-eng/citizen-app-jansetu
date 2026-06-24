# JANSETU - MY CONSTITUENCY — PRD

## Original Problem Statement
Build a production-ready Constituency Management Platform for MLAs, MPs, Corporators and their offices. Citizens raise/track complaints; political offices assign and verify work; politicians view dashboards. Roles: Citizen, Worker, PA, Politician, Super Admin. Urban (City→Ward→Area→Booth) and Rural (Taluka→Village→Wasti→Booth). Household-based citizen records (no family trees). Issue workflow, targeted notifications, visit scheduling, dev works, reports.

## Architecture (delivered)
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (Motor). JWT auth (staff) + mock OTP (citizens). Emergent Object Storage for photos (best-effort).
- **Frontend**: React + Tailwind + Shadcn UI. Outfit (headings) + Manrope (body). Deep India Navy (#0A1128) primary. Recharts for dashboards.
- **Routing**: BrowserRouter with role-aware `/app` shell; Layout sidebar adapts per role.
- **Seed**: Pune Cantonment constituency with 4 wards + 3 villages, demo admin/MLA/PA/2 workers/citizen, 4 sample issues, 1 visit, 1 notification, 4 dev works.

## User Personas
1. **Citizen** — Raises issues, tracks status, rates resolution, views works/visits/notifications.
2. **Worker** — Sees assigned issues, updates status, marks completion.
3. **PA / Staff** — Triages issues, assigns to workers, schedules visits, sends notifications.
4. **Politician (MLA/MP)** — Reviews dashboards, ward-wise performance, all issues.
5. **Super Admin** — Manages wards/villages, staff & roles, all entities.

## Core Requirements (Static)
- Mobile OTP login (citizen), Email+password (staff)
- Household record with auto Household-ID (H-10001…)
- Issue with auto code (ISS-10001…), 7-stage workflow with audit timeline
- Targeted notifications by ward/village/all
- Visit scheduling auto-creates notification
- Dev works tracker with statuses
- Star-rating feedback with re-open
- 360° household history view
- Dashboard with category/status/ward charts
- CSV export

## What's Been Implemented (2026-02)
- ✅ Auth: mock OTP + JWT staff
- ✅ Citizen registration with household creation
- ✅ Full issue lifecycle (create → assign → progress → resolve → verify/reopen)
- ✅ Photos upload via Emergent Object Storage (best-effort; optional)
- ✅ Visits + auto-notification
- ✅ Targeted notifications composer
- ✅ Development Works module
- ✅ Politician/PA dashboard with Recharts (category, status, ward)
- ✅ Citizens & Households 360° search
- ✅ Admin: Areas (ward/village/etc.) and Staff/Roles management
- ✅ CSV export of issues
- ✅ Seeded demo constituency
- ✅ Role-based access enforced server-side

## Backlog (Prioritized)
- **P1**: Real SMS OTP via Twilio (currently MOCKED — any 6-digit accepted)
- **P1**: Firebase push notifications (currently in-app only)
- **P1**: PDF report export (currently CSV only)
- **P2**: Government Schemes module (mentioned in spec but deferred)
- **P2**: Worker performance metrics page
- **P2**: Per-user notification read state
- **P2**: Photo upload reliability (storage init currently returns 400 — uploads disabled)
- **P3**: Multi-constituency tenant support
- **P3**: Booth-level analytics

## Next Action Items
1. Hook up Twilio for real SMS OTP
2. Wire Firebase Cloud Messaging (or OneSignal) for push
3. Add PDF (ReportLab) and Excel (openpyxl) exports
4. Investigate Object Storage init failure (400 — may need EMERGENT_LLM_KEY refresh)
