# JANSETU - MY CONSTITUENCY — PRD

## Original Problem Statement
Build a production-ready Constituency Management Platform for MLAs, MPs, Corporators and their offices. Citizens raise/track complaints; political offices assign and verify work; politicians view dashboards. Roles: Citizen, Worker, PA, Politician, Super Admin.

## Architecture (delivered)
- **Backend**: FastAPI + MongoDB. JWT (staff) + mock OTP (citizens). Object Storage best-effort.
- **Frontend**: React + Tailwind + Shadcn. Outfit + Manrope fonts. Navy primary. Recharts dashboards.
- **Routing**: Role-aware `/app` shell with sidebar that adapts per role.

## User Roles (refined)
1. **Citizen** — Raises, tracks, rates issues; sees notifications/visits/dev works.
2. **Worker** — Updates ONLY assigned issues; can Request Reassignment.
3. **PA / Staff** — Operational: assign issues, create visits (requires MLA approval), send notifications, create dev works (requires MLA approval). Cannot manage staff or areas.
4. **MLA / Politician** — Read-only monitoring + APPROVE visits, dev works, public announcements. Cannot assign issues, manage staff or areas.
5. **Super Admin** — Full control: manage staff/roles, wards/villages, system settings, can directly publish/approve.

## Implemented (2026-02)
- ✅ Auth (mock OTP + JWT staff)
- ✅ Citizen registration + household auto-ID (H-10001)
- ✅ Issue lifecycle with audit timeline (visible to all)
- ✅ Worker: status updates restricted to own assignments + **Request Reassignment**
- ✅ Visits with approval workflow (Pending → Approved/Published)
- ✅ Dev Works with approval flag + admin-only delete
- ✅ Notifications with sender name + recipients count + delivery status
- ✅ Household 360° view: members, issues, **development benefits**
- ✅ Targeted notifications by ward/village/all
- ✅ Politician dashboard (Recharts)
- ✅ Admin: Areas + Staff & Roles
- ✅ CSV export
- ✅ Seeded "Pune Cantonment" demo data
- ✅ 45/45 backend tests passing (iteration 1 + 2)

## Backlog (Prioritized)
- **P1**: Real SMS OTP via Twilio (currently MOCKED)
- **P1**: Firebase push notifications (currently in-app)
- **P1**: PDF report export
- **P2**: Government Schemes module
- **P2**: Worker performance metrics page
- **P2**: Photo upload reliability (storage init 400)
- **P3**: Multi-constituency tenancy
- **P3**: Booth-level analytics

## Next Action Items
1. Twilio for real SMS OTP
2. Firebase Cloud Messaging
3. PDF + Excel exports (ReportLab + openpyxl)
4. Fix Object Storage init
