# JANSETU — Production Deployment Guide
## Git-Based CI/CD Workflow

```
  Replit (development)
        │ git push
        ▼
  GitHub (single source of truth)
        │ git pull  ←── only way code reaches the VPS
        ▼
  Production VPS
  ./scripts/deploy.sh
  docker compose up -d --build
```

**Rule:** The VPS is never edited manually (except `.env` and `backend/secrets/`).
Every change goes: Replit → GitHub → VPS.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [VPS preparation](#2-vps-preparation)
3. [Isolation from VianBills](#3-isolation-from-vianbills)
4. [First-time setup on the VPS](#4-first-time-setup-on-the-vps)
5. [Environment variables](#5-environment-variables)
6. [Firebase push notifications](#6-firebase-push-notifications)
7. [Host Nginx + SSL](#7-host-nginx--ssl)
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
Internet
   │ HTTPS :443
   ▼
Host Nginx  (installed directly on VPS — shared with VianBills)
   │  routes by domain name
   ├─► vianbills.yourdomain.com  ──►  VianBills containers  (unchanged)
   │
   └─► jansetu.yourdomain.com   ──►  127.0.0.1:3000
                                         │
                               ┌─────────┴──────────────────────┐
                               │  Docker network: jansetu_internal│
                               │                                  │
                               │  jansetu-frontend-1 :80          │
                               │      │ /api proxy                │
                               │  jansetu-backend-1  :8000        │
                               │      │                           │
                               │  jansetu-mongodb-1  :27017       │
                               └──────────────────────────────────┘
```

### Port allocation (host-level)

| Service | Host port | Notes |
|---------|-----------|-------|
| Host Nginx | 80, 443 | Shared with VianBills, routes by domain |
| JanSetu frontend | 127.0.0.1:3000 | Internal only — not internet-facing |
| JanSetu MongoDB | 127.0.0.1:27018 | Different from VianBills on :27017 |
| JanSetu backend | internal only | Only reachable inside Docker network |

### Docker namespacing (Docker Compose `name: jansetu`)

Everything is prefixed — zero overlap with VianBills:

| Resource | Name |
|----------|------|
| Containers | `jansetu-mongodb-1`, `jansetu-backend-1`, `jansetu-frontend-1` |
| Volumes | `jansetu_mongo_data`, `jansetu_mongo_config`, `jansetu_uploads_data` |
| Network | `jansetu_internal` |

---

## 2. VPS Preparation

Run once on a fresh VPS (or skip steps already done for VianBills).

### System packages

```bash
apt-get update && apt-get upgrade -y
apt-get install -y git curl wget nginx certbot python3-certbot-nginx \
    python3 unzip software-properties-common
```

### Docker (skip if already installed for VianBills)

```bash
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
```

### Firewall (skip ports already open for VianBills)

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## 3. Isolation from VianBills

JanSetu and VianBills share the same VPS but are **completely separate** at every layer:

| Layer | VianBills | JanSetu | Conflict? |
|-------|-----------|---------|-----------|
| Docker project | `vianbills` (or default) | `jansetu` | ✅ None |
| Containers | `vianbills-*` | `jansetu-*` | ✅ None |
| Volumes | `vianbills_*` | `jansetu_*` | ✅ None |
| Network | `vianbills_*` | `jansetu_internal` | ✅ None |
| MongoDB port | 127.0.0.1:27017 | 127.0.0.1:27018 | ✅ None |
| Frontend port | (its own) | 127.0.0.1:3000 | ✅ None |
| Host Nginx | existing server blocks | new server block added | ✅ Additive only |
| SSL certs | existing certs | new cert for JanSetu domain | ✅ Separate |
| `.env` | not touched | `/opt/jansetu/.env` | ✅ None |

**You will never touch VianBills files, containers, or configuration.**

---

## 4. First-Time Setup on the VPS

```bash
# 1. Clone from GitHub (the single source of truth)
git clone https://github.com/flamingobos321-eng/citizen-app-jansetu.git /opt/jansetu
cd /opt/jansetu

# 2. Create .env from the template (only time you edit on the VPS)
cp .env.example .env
nano .env          # fill in every CHANGE_ME value — see §5

# 3. Add firebase-admin.json (if using push notifications)
mkdir -p backend/secrets
# Copy your Firebase service account JSON here:
nano backend/secrets/firebase-admin.json
chmod 600 backend/secrets/firebase-admin.json

# 4. Make scripts executable
chmod +x scripts/*.sh

# 5. Create backup directory
mkdir -p /var/backups/jansetu
```

---

## 5. Environment Variables

Copy `.env.example` → `.env` on the VPS and set every value. Key variables:

```bash
# MongoDB — use port 27018 (JanSetu's host port, avoids VianBills conflict)
MONGO_URL=mongodb://admin:YOUR_PASSWORD@127.0.0.1:27018/jansetu?authSource=admin
# OR using the internal Docker service name (recommended — no host port needed):
MONGO_URL=mongodb://admin:YOUR_PASSWORD@mongodb:27017/jansetu?authSource=admin
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=YOUR_STRONG_PASSWORD
DB_NAME=jansetu

# Auth
JWT_SECRET=<64-char random string>    # python3 -c "import secrets; print(secrets.token_hex(48))"
SESSION_SECRET=<another 64-char string>

# Storage
LOCAL_STORAGE_PATH=/var/data/jansetu/uploads

# CORS — your production domain
CORS_ORIGINS=https://jansetu.yourdomain.com

# Firebase
FIREBASE_CREDENTIALS_PATH=/app/secrets/firebase-admin.json
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key_from_firebase_console

# Workers (2 × CPU cores + 1)
WORKERS=3
```

> ⚠️ **Never commit `.env` to GitHub.** It is in `.gitignore`. The VPS `.env` is the only place secrets live.

> ℹ️ `DEPLOY_TAG` is set automatically by `scripts/deploy.sh` — do not set it manually.

---

## 6. Firebase Push Notifications

```bash
# On your local machine: download from Firebase Console
# Project Settings → Service Accounts → Generate new private key

# Upload to VPS
scp firebase-admin.json user@YOUR_VPS_IP:/opt/jansetu/backend/secrets/firebase-admin.json

# Secure it
ssh user@YOUR_VPS_IP "chmod 600 /opt/jansetu/backend/secrets/firebase-admin.json"
```

If this file is absent, the backend starts normally — push notifications are disabled and citizens receive in-app notifications only.

---

## 7. Host Nginx + SSL

This is the only step that touches the shared Nginx (used by VianBills too). It is **additive only** — existing VianBills server blocks are not modified.

### 7.1 Issue the SSL certificate

```bash
# Stop Nginx temporarily to free port 80 for the standalone ACME challenge
systemctl stop nginx

certbot certonly --standalone \
    --non-interactive --agree-tos \
    --email admin@yourdomain.com \
    -d jansetu.yourdomain.com

systemctl start nginx
```

### 7.2 Install the JanSetu Nginx config

```bash
# Replace the placeholder domain in the config
sed 's/JANSETU_DOMAIN/jansetu.yourdomain.com/g' \
    /opt/jansetu/config/nginx-jansetu.conf \
    > /etc/nginx/sites-available/jansetu.conf

# Enable it (does NOT affect VianBills)
ln -sf /etc/nginx/sites-available/jansetu.conf \
        /etc/nginx/sites-enabled/jansetu.conf

# Test and reload (not restart — keeps VianBills traffic flowing)
nginx -t && systemctl reload nginx
```

### 7.3 Auto-renewal

```bash
echo "15 3 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" \
    >> /etc/cron.d/certbot-renew
```

---

## 8. First Deploy

```bash
cd /opt/jansetu

# Build images and start all services
./scripts/deploy.sh

# Verify all containers are healthy
docker compose ps

# Check backend started correctly (look for migration logs)
docker compose logs backend | grep -E "startup|migrat|INFO|ERROR" | head -30

# Test the full stack
curl -s https://jansetu.yourdomain.com/api/health
# Expected: {"status": "ok"}
```

On first boot the backend runs `_migrate_to_multi_tenant()` automatically.
See §10 for details on what it does and why it is safe.

---

## 9. Routine Deploys

**Every deploy follows the same four steps — on Replit, then on the VPS:**

```
# 1. On Replit: develop, test, commit
git add -A && git commit -m "feat: describe your change"

# 2. Push to GitHub (Replit does this automatically, or run in Replit shell)
git push origin main

# 3. SSH into the VPS
ssh user@YOUR_VPS_IP

# 4. Deploy
cd /opt/jansetu && ./scripts/deploy.sh
```

`scripts/deploy.sh` does the following automatically:
1. Takes a database backup
2. `git reset --hard origin/main` (never merges — always fast-forward to GitHub)
3. Builds new Docker images tagged with the git commit hash
4. Restarts backend → waits for health check → restarts frontend
5. Verifies HTTP 200 from the frontend
6. Auto-rolls back the backend if the health check fails
7. Prunes old Docker images

The deploy is **idempotent** — running it twice with no new commits is safe.

---

## 10. Database Migrations

### How it works

JanSetu uses MongoDB (schemaless). Migrations are:

| Migration | Trigger | Safety |
|-----------|---------|--------|
| `ensure_indexes()` | Every startup | **Additive only** — creates indexes that don't exist, never drops |
| `_migrate_to_multi_tenant()` | First startup only | **Idempotent** — checks a version stamp; does nothing if already run |
| Field backfills (e.g. `$set` on new optional fields) | First startup | **Additive only** — only sets fields that don't already exist |

### Why existing data is never overwritten

- Every migration checks a version stamp (`system_meta._id = "multi_tenant"`) before running
- Fields are set with `$set` on docs where the field is missing — existing values are preserved
- No migration uses `drop`, `deleteMany`, `drop_collection`, or destructive `$unset`
- The MongoDB container uses a **named Docker volume** (`jansetu_mongo_data`) — `docker compose down` does **not** delete volumes; only `docker compose down -v` does (never run that in production)

### Check migration ran successfully

```bash
docker compose logs backend | grep -i "migrat"
# Expected output on first run:
#   Multi-tenant migration complete. Backfilled: {...}
# Expected on subsequent runs:
#   (silence — migration already done, skipped)
```

---

## 11. Backups and Restore

### Automatic daily backups

```bash
# Add to cron (runs at 2 AM)
echo "0 2 * * * root /opt/jansetu/scripts/backup.sh >> /var/log/jansetu-backup.log 2>&1" \
    > /etc/cron.d/jansetu-backup
```

### Manual backup

```bash
cd /opt/jansetu && ./scripts/backup.sh
ls /var/backups/jansetu/    # check it was created
```

### Restore from backup

```bash
# List available backups
ls -lt /var/backups/jansetu/

# Restore (interactive — asks for confirmation, then replaces DB + uploads)
cd /opt/jansetu && ./scripts/restore.sh /var/backups/jansetu/20250716_020000
```

Restore does **not** affect VianBills — it only touches `jansetu_mongo_data` and `jansetu_uploads_data` volumes.

---

## 12. Rollback Procedure

### Option A — Roll back code only (no data change)

Use this when the new code is broken but the database is fine.

```bash
cd /opt/jansetu

# Find the last known-good commit
git log --oneline -10

# Roll back to it
git checkout <COMMIT_HASH>

# Rebuild and redeploy from that commit
DEPLOY_TAG=<COMMIT_HASH> docker compose build
DEPLOY_TAG=<COMMIT_HASH> docker compose up -d --force-recreate backend frontend

# Verify
curl -s https://jansetu.yourdomain.com/api/health
```

### Option B — Full rollback (code + database)

Use this when a migration caused data problems.

```bash
# 1. Find the backup taken just before the bad deploy
ls -lt /var/backups/jansetu/

# 2. Restore data (interactive)
./scripts/restore.sh /var/backups/jansetu/<TIMESTAMP>

# 3. Roll back code
git checkout <COMMIT_HASH>

# 4. Rebuild from old code
DEPLOY_TAG=<COMMIT_HASH> docker compose build
DEPLOY_TAG=<COMMIT_HASH> docker compose up -d --force-recreate backend frontend
```

### Option C — Emergency: keep VianBills running, stop JanSetu only

```bash
# Stop only JanSetu — VianBills is unaffected
docker compose down        # (run from /opt/jansetu)

# Restart JanSetu
docker compose up -d
```

---

## 13. Health Checks and Monitoring

### Built-in health endpoints

```bash
# API health (tests DB connectivity)
curl https://jansetu.yourdomain.com/api/health

# Nginx health (tests host proxy)
curl https://jansetu.yourdomain.com/nginx-health

# Container status
docker compose ps
docker stats --no-stream
```

### Recommended free tools

| Tool | Purpose | Setup |
|------|---------|-------|
| **UptimeRobot** | HTTPS uptime + cert expiry alerts | Free tier, 5-min checks |
| **ctop** | Live Docker resource usage | `apt install ctop` |
| **Netdata** | CPU/RAM/disk/Docker metrics | `docker run -d --name=netdata ...` |

---

## 14. Logs

```bash
# All services
docker compose logs -f

# Backend only (most useful for debugging)
docker compose logs -f backend

# Last hour of backend errors
docker compose logs --since 1h backend | grep -i error

# Nginx access logs (inside frontend container)
docker compose exec frontend tail -f /var/log/nginx/access.log

# Host Nginx logs (shared — includes VianBills traffic too)
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Deploy log
cat /var/log/jansetu-deploy.log 2>/dev/null || echo "No deploy log yet"
```

Log rotation is configured in `docker-compose.yml` (`json-file` driver, capped at 100 MB × 7 files for backend, 50 MB × 5 files for others).

---

## 15. Security Hardening

### Already in place

- JWT on all protected endpoints
- Per-IP rate limiting on auth endpoints (5 attempts / 5 min)
- MongoDB not exposed to internet (127.0.0.1 only)
- HTTPS-only with HSTS header (host Nginx)
- Security headers: X-Frame-Options, CSP, X-Content-Type-Options (host Nginx)
- Non-root user inside backend container
- Tenant isolation on every DB query
- `backend/secrets/` is in `.gitignore` — keys never reach GitHub

### Additional steps to do on the VPS

```bash
# Disable SSH password auth (keys only)
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Fail2ban — ban brute-force SSH attempts
apt-get install -y fail2ban
systemctl enable fail2ban

# Automatic security patches
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 16. Troubleshooting

### Backend won't start after deploy

```bash
docker compose logs backend | tail -40
# Common fixes:
# - Wrong MONGO_URL → edit .env, run docker compose restart backend
# - Missing Python package → docker compose build backend && docker compose up -d --no-deps backend
# - firebase-admin.json missing → see §6
```

### MongoDB container unhealthy

```bash
docker compose logs mongodb | tail -20
# Common causes:
# - MONGO_ROOT_PASSWORD changed after the volume was created
#   Fix: docker compose down, docker volume rm jansetu_mongo_data (⚠️ deletes data!), docker compose up -d
#   OR: restore from backup
# - Disk full: df -h
```

### `curl: (7) Failed to connect` on port 3000

```bash
# Is the frontend container running?
docker compose ps frontend
# Restart it
docker compose restart frontend
```

### Host Nginx 502 Bad Gateway

```bash
# Is the frontend container healthy?
docker compose ps
# Check the proxy target
curl -s http://127.0.0.1:3000/health
# Reload host Nginx
nginx -t && systemctl reload nginx
```

### `docker compose` command not found

```bash
# Use Docker Compose v2 plugin syntax
docker compose version
# If missing: reinstall with docker-compose-plugin (see §2)
```

### VianBills stopped working after adding JanSetu

The only change to the shared infrastructure is adding `/etc/nginx/sites-enabled/jansetu.conf`.
If that caused an issue:

```bash
# Remove the JanSetu nginx config and reload
rm /etc/nginx/sites-enabled/jansetu.conf
nginx -t && systemctl reload nginx
# VianBills traffic is now restored — debug jansetu.conf separately
```

---

## Quick Reference

```bash
# Deploy latest from GitHub
cd /opt/jansetu && ./scripts/deploy.sh

# Check container health
docker compose ps

# View live logs
docker compose logs -f

# Backup now
./scripts/backup.sh

# Stop JanSetu (VianBills unaffected)
docker compose down

# Start JanSetu
docker compose up -d

# Rollback to a specific commit
git checkout <HASH> && DEPLOY_TAG=<HASH> docker compose up -d --build
```
