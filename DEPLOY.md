# Multi-app workspace path update

The existing web frontend now lives in `artifacts/jansetu-web/` rather than
`frontend/`. Docker Compose builds the frontend from that directory using the
same CRACO production build and Nginx configuration. GitHub remains the source
of truth; the existing `scripts/deploy.sh` workflow is unchanged. Backend source,
MongoDB configuration, named volumes, service names, production `.env`, and
private Firebase service-account mount remain unchanged. No production
migration, deployment, or data reset is part of this workspace port.

For Replit development, use the two managed artifact workflows documented in
`replit.md`, not the old `cd frontend && yarn start` command. The original frontend
and backend are retained locally in `.migration-backup/` for recovery. Keep private
configuration and uploaded files outside Git as before.

The workspace Python installer uses the root `pyproject.toml` and `uv.lock` for the
runtime modules imported by JanSetu, pinned to their existing direct versions.
The original broad backend requirement snapshots remain unchanged for reference.
The snapshot contains unrelated development/AI packages that cannot all be
resolved by a new universal lockfile. The backend Dockerfile now installs the
hash-pinned `backend/requirements-runtime.txt`, exported from the same `uv.lock`,
so Docker and the workspace use the same resolvable runtime.

After changing Python dependencies, regenerate the production dependency file:

```sh
uv export --frozen --no-dev --no-emit-project --format requirements-txt \
  --output-file backend/requirements-runtime.txt
```

Commit both lock files together. The export only writes a dependency manifest;
it does not start the app, run migrations, or access MongoDB.

Development API startup explicitly skips the original startup seed/backfill/
index/escalation lifecycle. This avoids migration writes to an existing MongoDB.
It does not make API mutations read-only; normal user actions can still write.
Production startup behavior is unchanged.

---

# JANSETU — Production Deployment Guide
## Git-Based Workflow · Nginx Proxy Manager · Docker Compose

```
  Replit (development)
        │ git push
        ▼
  GitHub (single source of truth)
        │ git pull  ←── only way code ever reaches the VPS
        ▼
  Production VPS
  ./scripts/deploy.sh
  docker compose up -d --build
```

**Rule:** The VPS is never edited manually except for `.env` and `backend/secrets/`.
Every code change goes: Replit → GitHub → VPS.

Reverse proxy and SSL are managed **entirely by Nginx Proxy Manager**.
No `/etc/nginx/sites-available`, no Certbot, no host Nginx configuration is needed.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [VPS preparation](#2-vps-preparation)
3. [Isolation from VianBills](#3-isolation-from-vianbills)
4. [First-time setup on the VPS](#4-first-time-setup-on-the-vps)
5. [Environment variables](#5-environment-variables)
6. [Firebase push notifications](#6-firebase-push-notifications)
7. [Nginx Proxy Manager configuration](#7-nginx-proxy-manager-configuration)
8. [First deploy](#8-first-deploy)
9. [Routine deploys](#9-routine-deploys)
10. [Database migrations](#10-database-migrations)
11. [Backups and restore](#11-backups-and-restore)
12. [Rollback procedure](#12-rollback-procedure)
13. [Health checks and monitoring](#13-health-checks-and-monitoring)
14. [Logs](#14-logs)
15. [Security hardening](#15-security-hardening)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Architecture Overview

```
Internet (HTTPS)
      │
      ▼
Nginx Proxy Manager   ← manages SSL, runs in its own Docker project (VianBills)
      │
      ├─► vianbills.yourdomain.com  ──►  VianBills containers  (unchanged)
      │
      └─► jansetu.yourdomain.com   ──►  127.0.0.1:3000
                                               │
                                 ┌─────────────┴─────────────────────┐
                                 │   Docker project: jansetu          │
                                 │   Network: jansetu_internal        │
                                 │                                    │
                                 │   jansetu-frontend-1  :80 → :3000  │
                                 │         │ /api proxy (internal)    │
                                 │   jansetu-backend-1   :8000        │
                                 │         │                          │
                                 │   jansetu-mongodb-1   :27017→:27018│
                                 └────────────────────────────────────┘
```

### Host port allocation

| Service | Host port | Who connects |
|---------|-----------|--------------|
| JanSetu frontend | `127.0.0.1:3000` | Nginx Proxy Manager |
| JanSetu backend | `127.0.0.1:8000` | NPM (optional direct route) |
| JanSetu MongoDB | `127.0.0.1:27018` | Local admin / backup scripts only |

Ports **80 and 443 are not bound** by JanSetu — NPM owns them.

### Docker namespacing (`name: jansetu`)

All Docker resources are prefixed — zero overlap with VianBills:

| Resource | Name |
|----------|------|
| Containers | `jansetu-mongodb-1`, `jansetu-backend-1`, `jansetu-frontend-1` |
| Volumes | `jansetu_mongo_data`, `jansetu_mongo_config`, `jansetu_uploads_data` |
| Network | `jansetu_internal` |

---

## 2. VPS Preparation

Run these once. Skip anything already installed for VianBills.

```bash
# System packages
apt-get update && apt-get upgrade -y
apt-get install -y git curl wget python3

# Docker (skip if already installed)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \
    signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

systemctl enable docker && systemctl start docker
docker --version && docker compose version   # verify

# Backup directory
mkdir -p /var/backups/jansetu
```

---

## 3. Isolation from VianBills

JanSetu and VianBills share the VPS but are **completely separate** at every layer:

| Layer | VianBills | JanSetu | Conflict? |
|-------|-----------|---------|-----------|
| Docker project | `vianbills` (or default) | `jansetu` | ✅ None |
| Containers | `vianbills-*` | `jansetu-*` | ✅ None |
| Volumes | `vianbills_*` | `jansetu_*` | ✅ None |
| Network | `vianbills_*` | `jansetu_internal` | ✅ None |
| MongoDB port | `127.0.0.1:27017` | `127.0.0.1:27018` | ✅ None |
| Reverse proxy / SSL | NPM proxy host (existing) | NPM proxy host (new — additive only) | ✅ None |
| Ports 80 / 443 | Owned by NPM | Not touched by JanSetu | ✅ None |

**You will not touch any VianBills files, containers, or NPM proxy hosts.**

---

## 4. First-Time Setup on the VPS

```bash
# 1. Clone from GitHub
git clone https://github.com/flamingobos321-eng/citizen-app-jansetu.git /opt/jansetu
cd /opt/jansetu

# 2. Create .env (the only file you edit directly on the VPS)
cp .env.example .env
nano .env          # fill in every CHANGE_ME value — see §5

# 3. Firebase push notifications (optional)
mkdir -p backend/secrets
# Paste your Firebase service-account JSON:
nano backend/secrets/firebase-admin.json
chmod 600 backend/secrets/firebase-admin.json

# 4. Make scripts executable
chmod +x scripts/*.sh
```

---

## 5. Environment Variables

Edit `/opt/jansetu/.env`. Key values:

```bash
# ── MongoDB ──────────────────────────────────────────────────────────────────
# Use the internal Docker service name — no host port needed inside the stack
MONGO_URL=mongodb://admin:YOUR_PASSWORD@mongodb:27017/jansetu?authSource=admin
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=YOUR_STRONG_RANDOM_PASSWORD   # generate: openssl rand -hex 24
DB_NAME=jansetu

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=YOUR_64_CHAR_RANDOM_STRING     # python3 -c "import secrets; print(secrets.token_hex(48))"
SESSION_SECRET=ANOTHER_64_CHAR_STRING

# ── File storage ──────────────────────────────────────────────────────────────
LOCAL_STORAGE_PATH=/var/data/jansetu/uploads

# ── CORS — your production domain ─────────────────────────────────────────────
CORS_ORIGINS=https://jansetu.yourdomain.com

# ── Firebase ──────────────────────────────────────────────────────────────────
FIREBASE_CREDENTIALS_PATH=/app/secrets/firebase-admin.json
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key_from_firebase_console

# ── Uvicorn workers ───────────────────────────────────────────────────────────
WORKERS=3
```

> ⚠️ `.env` is in `.gitignore` — it never reaches GitHub. It lives only on the VPS.
> `DEPLOY_TAG` is set automatically by `scripts/deploy.sh`. Do not set it manually.

---

## 6. Firebase Push Notifications

```bash
# Download from: Firebase Console → Project Settings → Service Accounts
#                → Generate new private key

# Upload to the VPS
scp firebase-admin.json user@YOUR_VPS_IP:/opt/jansetu/backend/secrets/firebase-admin.json
ssh user@YOUR_VPS_IP "chmod 600 /opt/jansetu/backend/secrets/firebase-admin.json"
```

If `firebase-admin.json` is absent, the backend starts normally — push notifications are disabled and citizens receive in-app notifications only.

---

## 7. Nginx Proxy Manager Configuration

This is the only step that involves NPM. No files are edited on the VPS — everything is done through the NPM web UI.

### 7.1 Add a new Proxy Host for JanSetu

1. Open your NPM admin panel (e.g. `http://YOUR_VPS_IP:81`)
2. Go to **Proxy Hosts → Add Proxy Host**
3. Fill in the **Details** tab:

   | Field | Value |
   |-------|-------|
   | Domain Names | `jansetu.yourdomain.com` |
   | Scheme | `http` |
   | Forward Hostname / IP | `127.0.0.1` |
   | Forward Port | `3000` |
   | Cache Assets | Off |
   | Block Common Exploits | On |
   | Websockets Support | On |

4. Switch to the **SSL** tab:
   - SSL Certificate: **Request a new SSL Certificate**
   - Provider: Let's Encrypt
   - Email: your admin email
   - Force SSL: ✅
   - HTTP/2 Support: ✅
   - HSTS Enabled: ✅

5. Click **Save** — NPM requests the certificate and activates the proxy immediately.

### 7.2 Optional: expose the backend API directly

If you want NPM to proxy `/api` requests directly to the backend (bypassing the frontend container), add a second proxy host or use NPM's **Custom Locations** tab on the same proxy host:

| Location | Scheme | Forward Host | Forward Port |
|----------|--------|--------------|--------------|
| `/api` | `http` | `127.0.0.1` | `8000` |

> In most setups this is **not needed** — the frontend container's internal Nginx already proxies `/api → backend:8000` over the Docker network. Only add this if you need direct API access from NPM.

### 7.3 Verify

```bash
# Should return {"status": "ok"}
curl -s https://jansetu.yourdomain.com/api/health

# Should return the React app HTML
curl -sI https://jansetu.yourdomain.com/ | head -5
```

---

## 8. First Deploy

```bash
cd /opt/jansetu

# Build and start all containers
./scripts/deploy.sh

# Verify all containers are healthy
docker compose ps

# Check the backend started and migration ran
docker compose logs backend | grep -E "startup|migrat|INFO|ERROR" | head -30

# Test directly (before NPM is configured)
curl -s http://127.0.0.1:3000/health       # frontend: should return "ok"
curl -s http://127.0.0.1:8000/api/health   # backend:  should return {"status":"ok"}

# Test through NPM (after proxy host is configured)
curl -s https://jansetu.yourdomain.com/api/health
```

On first boot the backend auto-runs `_migrate_to_multi_tenant()`. See §10 for details.

---

## 9. Routine Deploys

```bash
# 1. On Replit: develop and commit
git add -A && git commit -m "feat: describe change"

# 2. Push to GitHub (or Replit does it automatically)
git push origin main

# 3. SSH into VPS and deploy
ssh user@YOUR_VPS_IP
cd /opt/jansetu && ./scripts/deploy.sh
```

`scripts/deploy.sh` automatically:
1. Takes a database backup
2. `git reset --hard origin/main` (never merges — always fast-forward to GitHub)
3. Builds new images tagged with the git commit hash
4. Restarts backend → waits for health check → restarts frontend
5. Verifies the frontend responds on port 3000
6. Auto-rolls back the backend if the health check fails
7. Prunes old Docker images

Deploys are **idempotent** — running it twice with no new commits is safe.

---

## 10. Database Migrations

### How it works

JanSetu uses MongoDB (schemaless). Migrations run automatically on startup.

| Migration | Trigger | Safety |
|-----------|---------|--------|
| `ensure_indexes()` | Every startup | **Additive only** — creates missing indexes, never drops |
| `_migrate_to_multi_tenant()` | First startup only | **Idempotent** — version-stamped, skipped on all subsequent boots |
| Field backfills | First startup | **Additive only** — only sets fields that don't already exist (`$set` on missing fields) |

### Why existing data is never overwritten

- Every migration checks a version stamp (`system_meta._id = "multi_tenant"`) before running
- All writes use `$set` only on documents where the field is absent — existing values are preserved
- No migration uses `drop`, `deleteMany`, or destructive `$unset`
- The MongoDB container stores data in a **named Docker volume** (`jansetu_mongo_data`) — `docker compose down` does **not** delete volumes; only `docker compose down -v` does (never run that in production)

### Check migration status

```bash
docker compose logs backend | grep -i "migrat"
# First run:  "Multi-tenant migration complete. Backfilled: {...}"
# After that: (silence — already done, skipped)
```

---

## 11. Backups and Restore

### Schedule automatic daily backups

```bash
echo "0 2 * * * root /opt/jansetu/scripts/backup.sh >> /var/log/jansetu-backup.log 2>&1" \
    > /etc/cron.d/jansetu-backup
```

### Manual backup

```bash
cd /opt/jansetu && ./scripts/backup.sh
ls /var/backups/jansetu/
```

### Restore

```bash
ls -lt /var/backups/jansetu/           # list available backups
./scripts/restore.sh /var/backups/jansetu/20250716_020000
```

Restore only touches `jansetu_*` volumes — VianBills and NPM are unaffected.

---

## 12. Rollback Procedure

### Option A — Code rollback (database is fine)

```bash
cd /opt/jansetu
git log --oneline -10                          # find the good commit hash
git checkout <COMMIT_HASH>
DEPLOY_TAG=<COMMIT_HASH> docker compose build
DEPLOY_TAG=<COMMIT_HASH> docker compose up -d --force-recreate backend frontend
curl -s http://127.0.0.1:3000/health           # verify
```

### Option B — Full rollback (code + data)

```bash
# 1. Restore data (the backup taken before the bad deploy)
./scripts/restore.sh /var/backups/jansetu/<TIMESTAMP>

# 2. Roll back code
git checkout <COMMIT_HASH>
DEPLOY_TAG=<COMMIT_HASH> docker compose build
DEPLOY_TAG=<COMMIT_HASH> docker compose up -d --force-recreate backend frontend
```

### Option C — Stop JanSetu without affecting VianBills

```bash
cd /opt/jansetu
docker compose down          # stops JanSetu containers only; VianBills and NPM unaffected
docker compose up -d         # restart when ready
```

---

## 13. Health Checks and Monitoring

```bash
# Backend health (tests DB connection)
curl -s http://127.0.0.1:8000/api/health
# → {"status": "ok"}

# Frontend health (tests container Nginx)
curl -s http://127.0.0.1:3000/health
# → ok

# Full stack (through NPM + SSL)
curl -s https://jansetu.yourdomain.com/api/health

# Container status
docker compose ps
docker stats --no-stream
```

NPM's built-in dashboard shows the proxy host status and SSL cert expiry.

---

## 14. Logs

```bash
# All JanSetu containers
docker compose logs -f

# Backend only
docker compose logs -f backend

# Errors in the last hour
docker compose logs --since 1h backend | grep -i error

# Nginx access log (inside frontend container)
docker compose exec frontend tail -f /var/log/nginx/access.log
```

Log rotation is configured in `docker-compose.yml` (json-file driver):
- Backend: 100 MB × 7 files
- Frontend / MongoDB: 50 MB × 5 files

---

## 15. Security Hardening

### Already in place

- JWT on all protected endpoints
- Per-IP rate limiting on auth routes (5 attempts / 5 min)
- MongoDB bound to `127.0.0.1:27018` — not internet-facing
- Backend bound to `127.0.0.1:8000` — not internet-facing
- Frontend bound to `127.0.0.1:3000` — not internet-facing
- NPM handles HTTPS, HSTS, and certificate rotation
- Non-root user inside backend container
- Tenant isolation on every DB query
- `backend/secrets/` in `.gitignore` — never reaches GitHub

### Recommended VPS steps

```bash
# SSH: disable password auth (keys only)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Fail2ban: auto-ban brute-force SSH
apt-get install -y fail2ban && systemctl enable fail2ban

# Automatic OS security patches
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades

# UFW: only expose SSH (ports 80/443 owned by NPM, already open)
ufw allow 22/tcp
ufw enable
```

---

## 16. Troubleshooting

### Backend won't start

```bash
docker compose logs backend | tail -40
# Common causes:
# - Wrong MONGO_URL in .env → fix .env, run: docker compose restart backend
# - firebase-admin.json invalid → see §6, or remove the file to disable push
# - Missing Python package → docker compose build backend && docker compose up -d --no-deps backend
```

### NPM shows "502 Bad Gateway"

```bash
# Is the frontend container running and healthy?
docker compose ps
curl -s http://127.0.0.1:3000/health
# Not responding? Restart:
docker compose restart frontend
```

### MongoDB unhealthy

```bash
docker compose logs mongodb | tail -20
# Disk full?
df -h
# Password mismatch (changed after volume was created)?
# Restore from backup — see §11
```

### `docker compose` not found

```bash
docker compose version
# If missing, reinstall docker-compose-plugin — see §2
```

### Port 3000 or 8000 already in use

```bash
lsof -i :3000
lsof -i :8000
# If another service owns it, change JANSETU_FRONTEND_PORT / JANSETU_BACKEND_PORT
# in .env and update docker-compose.yml ports accordingly
```

---

## Quick Reference

```bash
# Deploy latest code from GitHub
cd /opt/jansetu && ./scripts/deploy.sh

# Container status
docker compose ps

# Live logs
docker compose logs -f

# Backup now
./scripts/backup.sh

# Stop JanSetu only (VianBills unaffected)
docker compose down

# Restart JanSetu
docker compose up -d

# Rollback to a specific commit
git checkout <HASH> && DEPLOY_TAG=<HASH> docker compose up -d --build
```
