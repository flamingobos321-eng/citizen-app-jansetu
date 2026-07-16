---
name: Jansetu modules built
description: Features added after initial import — patterns, gotchas, and conventions to stay consistent with.
---

## Campaigns & Field Operations (pages/Campaigns.jsx, pages/CampaignDetail.jsx, pages/CampaignRespond.jsx)
- Backend: collections `campaigns`, `campaign_responses`, `campaign_tasks` in MongoDB
- All campaign models live at the **end** of `backend/models.py`
- Campaign routes are appended to `backend/server.py` before the `@app.on_event("shutdown")` block
- `@dnd-kit/core` + `@dnd-kit/sortable` installed for form-builder drag-and-drop
- Routes: `/app/campaigns`, `/app/campaigns/:id`, `/app/campaigns/:id/respond`
- Nav item `Megaphone` added to both staff sidebar and worker sidebar in `Layout.jsx`

## Bulk Issue Status Update (POST /issues/bulk-status)
- Model `BulkIssueStatusUpdate` is imported in the **top-level** `from models import` block (line ~32 of server.py) — not in the campaigns section
- Uses `pymongo.UpdateOne` + `db.issues.bulk_write()` for a single MongoDB round-trip
- Push notifications consolidated per citizen (1 summary per citizen, not 1 per issue)
- `asyncio.Semaphore(10)` caps concurrent FCM sends; hard cap of 200 unique citizens per call
- **Why:** prevents FCM quota exhaustion and citizen notification spam on bulk admin actions

## VPS Production Deployment
- `docker-compose.yml`: health checks on all 3 services; `uploads_data` named volume for local file storage; `depends_on` with `condition: service_healthy`
- `backend/Dockerfile`: non-root `jansetu` user; HEALTHCHECK instruction; `WORKERS` env var respected
- `frontend/nginx.conf`: full security headers (HSTS, CSP, X-Frame-Options etc.); gzip; immutable cache for JS/CSS; no-cache for HTML
- `scripts/backup.sh`: mongodump + uploads volume → `/var/backups/jansetu`; 30-day rotation; cron-ready
- `scripts/restore.sh`: interactive restore with confirmation prompt
- `scripts/update.sh`: pre-backup → git pull → docker build → rolling restart → health check
- `DEPLOY.md`: 19-section comprehensive guide covering all spec requirements
- **Why:** storage_util.py auto-selects local filesystem when S3 vars absent; `LOCAL_STORAGE_PATH=/var/data/jansetu/uploads` maps to the `uploads_data` volume mount

## Key import pattern in server.py
- All models used early in server.py (before line 5000) must be in the **top-level** `from models import` block at line 28
- Models only used in the campaigns section (line 5000+) can be in the secondary import there
- Duplicate imports cause a silent override, not an error — but misplaced imports cause `NameError` if the model is used before its import line
