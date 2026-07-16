# JANSETU — Production Deployment Guide

Self-hosted Ubuntu 24.04 VPS · MongoDB Community · Docker Compose · Nginx · Let's Encrypt

---

## Table of Contents

1. [Production readiness checklist](#1-production-readiness-checklist)
2. [VPS preparation](#2-vps-preparation)
3. [MongoDB compatibility](#3-mongodb-compatibility)
4. [Project setup](#4-project-setup)
5. [Environment variables](#5-environment-variables)
6. [Firebase (push notifications)](#6-firebase-push-notifications)
7. [First-time deployment](#7-first-time-deployment)
8. [SSL / Let's Encrypt](#8-ssl--lets-encrypt)
9. [DNS](#9-dns)
10. [Verify everything works](#10-verify-everything-works)
11. [Routine updates](#11-routine-updates)
12. [Backups and restore](#12-backups-and-restore)
13. [Monitoring](#13-monitoring)
14. [Logging](#14-logging)
15. [Security hardening](#15-security-hardening)
16. [Performance tuning](#16-performance-tuning)
17. [Scaling roadmap](#17-scaling-roadmap)
18. [Rollback procedure](#18-rollback-procedure)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Production Readiness Checklist

Complete every item before going live.

| # | Item | Notes |
|---|------|-------|
| ✅ | VPS with Ubuntu 24.04 | 2 vCPU / 4 GB RAM minimum |
| ✅ | Domain name with DNS A record pointing to VPS | |
| ✅ | SSH access with key-based authentication | |
| ✅ | UFW firewall configured (ports 22, 80, 443 only) | |
| ✅ | Docker + Docker Compose installed | |
| ✅ | `.env` file created from `.env.example` | |
| ✅ | `JWT_SECRET` set to 64+ character random string | |
| ✅ | `MONGO_ROOT_PASSWORD` set to strong password | |
| ✅ | `CORS_ORIGINS` set to your production domain | |
| ✅ | SSL certificate issued by Let's Encrypt | |
| ✅ | `YOUR_DOMAIN` replaced in `frontend/nginx.conf` | |
| ✅ | Firebase `firebase-admin.json` uploaded (or push disabled) | |
| ✅ | `LOCAL_STORAGE_PATH` volume working (or S3 configured) | |
| ✅ | `scripts/backup.sh` tested and cron scheduled | |
| ✅ | Health check `GET /api/health` returns 200 | |
| ✅ | Log rotation configured (logrotate or Docker json-file) | |
| ✅ | MongoDB authentication enabled | |
| ✅ | Ports 8000 and 27017 NOT exposed to the internet | |

---

## 2. VPS Preparation

Run all commands as root or with `sudo`.

### 2.1 System update

```bash
apt-get update && apt-get upgrade -y
apt-get install -y git curl wget unzip software-properties-common ca-certificates gnupg lsb-release
```

### 2.2 UFW Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP (Let's Encrypt + redirect)
ufw allow 443/tcp      # HTTPS
ufw enable
ufw status verbose
```

### 2.3 Docker

```bash
# Add Docker's official GPG key and repo
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \
    signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow your deploy user to run docker without sudo
usermod -aG docker $USER
newgrp docker

# Enable Docker to start on boot
systemctl enable docker
systemctl start docker
docker --version          # verify
docker compose version    # verify
```

### 2.4 Certbot (Let's Encrypt)

```bash
apt-get install -y certbot
certbot --version    # verify
```

### 2.5 Backup directory

```bash
mkdir -p /var/backups/jansetu
```

---

## 3. MongoDB Compatibility

JANSETU uses **MongoDB Community Edition 7** (the version pinned in `docker-compose.yml`). It uses:

- Motor (async pymongo driver) for all queries
- Standard indexes (no Atlas-only features)
- No Atlas Search, Atlas Triggers, or Atlas Data API
- Indexes are created automatically on startup via `ensure_indexes()`

No Atlas-specific code exists. Any MongoDB 6+ Community instance works.

**Recommended version:** MongoDB 7 (LTS — pinned in `docker-compose.yml`)

---

## 4. Project Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/jansetu.git /opt/jansetu
cd /opt/jansetu

# Create .env
cp .env.example .env
nano .env          # fill in all CHANGE_ME values

# Make scripts executable
chmod +x scripts/*.sh
```

### Replace the domain placeholder

```bash
# In frontend/nginx.conf — replace both occurrences of YOUR_DOMAIN
sed -i 's/YOUR_DOMAIN/app.yourdomain.com/g' frontend/nginx.conf
```

---

## 5. Environment Variables

Every required variable is documented in `.env.example`.  
Critical ones to set before first boot:

| Variable | How to generate | Required |
|----------|-----------------|----------|
| `JWT_SECRET` | `python3 -c "import secrets; print(secrets.token_hex(48))"` | ✅ |
| `SESSION_SECRET` | same as above | ✅ |
| `MONGO_ROOT_PASSWORD` | use a password manager | ✅ |
| `MONGO_URL` | include credentials and `authSource=admin` | ✅ |
| `CORS_ORIGINS` | `https://yourdomain.com` | ✅ |
| `LOCAL_STORAGE_PATH` | `/var/data/jansetu/uploads` (inside container) | ✅ |
| `FIREBASE_CREDENTIALS_PATH` | `/app/secrets/firebase-admin.json` | push only |
| `SMTP_*` | your mail provider | email only |

---

## 6. Firebase (Push Notifications)

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate new private key** → download the JSON
3. Place it at `backend/secrets/firebase-admin.json`
4. The `docker-compose.yml` mounts it read-only into the container

```bash
mkdir -p backend/secrets
cp ~/firebase-admin.json backend/secrets/firebase-admin.json
chmod 600 backend/secrets/firebase-admin.json
```

If you don't need push notifications, leave the file absent — the app falls back to inbox-only delivery automatically.

---

## 7. First-Time Deployment

### 7.1 Pre-SSL startup (HTTP only, to get the certificate)

Temporarily comment out the HTTPS `server {}` block in `frontend/nginx.conf`
and the `return 301` line so Nginx starts on port 80 only:

```bash
# Start all services
docker compose up -d

# Check everything started
docker compose ps
docker compose logs -f backend   # watch for startup errors
```

### 7.2 Issue the SSL certificate (see §8)

### 7.3 Re-enable HTTPS and restart

```bash
# Restore the full nginx.conf (HTTPS block + redirect)
docker compose restart frontend
```

---

## 8. SSL / Let's Encrypt

### Issue the certificate (run ONCE)

```bash
# Stop any process using port 80 first
docker compose stop frontend

certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@yourdomain.com \
    -d yourdomain.com \
    -d www.yourdomain.com

docker compose start frontend
```

### Auto-renewal via cron

```bash
# Renew daily at 3:15 AM, reload Nginx on success
echo "15 3 * * * root certbot renew --quiet --post-hook 'docker compose -f /opt/jansetu/docker-compose.yml restart frontend'" \
    >> /etc/cron.d/certbot-renew
```

### Test renewal

```bash
certbot renew --dry-run
```

---

## 9. DNS

Point your domain to the VPS IP **before** running Certbot.

| Type | Name | Value |
|------|------|-------|
| A | `yourdomain.com` | `<VPS_IP>` |
| A | `www.yourdomain.com` | `<VPS_IP>` |

TTL 300 s for initial setup; raise to 3600 s after it's stable.

---

## 10. Verify Everything Works

```bash
# All containers healthy
docker compose ps

# Backend health endpoint
curl https://yourdomain.com/api/health

# MongoDB connectivity (from inside backend container)
docker compose exec backend python -c "
import asyncio, motor.motor_asyncio, os
client = motor.motor_asyncio.AsyncIOMotorClient(os.environ['MONGO_URL'])
async def ping(): print(await client.admin.command('ping'))
asyncio.run(ping())
"

# View live logs
docker compose logs -f --tail=50
```

---

## 11. Routine Updates

```bash
cd /opt/jansetu
./scripts/update.sh
```

The update script:
1. Takes a pre-update backup
2. `git pull --ff-only`
3. Rebuilds Docker images
4. Restarts backend, waits for healthy, then restarts frontend
5. Runs a final HTTP health check
6. Prints the rollback command if anything fails

---

## 12. Backups and Restore

### Manual backup

```bash
./scripts/backup.sh
ls /var/backups/jansetu/
```

### Scheduled backup (cron — runs at 2 AM daily)

```bash
echo "0 2 * * * root /opt/jansetu/scripts/backup.sh >> /var/log/jansetu-backup.log 2>&1" \
    >> /etc/cron.d/jansetu-backup
```

### Restore from backup

```bash
# List available backups
ls /var/backups/jansetu/

# Restore (interactive — will ask for confirmation)
./scripts/restore.sh /var/backups/jansetu/20250716_020000
```

Restore replaces the live database and uploads volume, then restarts the backend.  
**Test your restore procedure periodically** — a backup you've never tested is not a backup.

### mongodump / mongorestore manually

```bash
# Dump
docker compose exec mongodb mongodump \
    --username $MONGO_ROOT_USER --password $MONGO_ROOT_PASSWORD \
    --authenticationDatabase admin --db jansetu --out /tmp/dump
docker compose cp mongodb:/tmp/dump ./backups/manual_dump

# Restore
docker compose cp ./backups/manual_dump mongodb:/tmp/restore
docker compose exec mongodb mongorestore \
    --username $MONGO_ROOT_USER --password $MONGO_ROOT_PASSWORD \
    --authenticationDatabase admin --db jansetu --drop /tmp/restore/jansetu
```

---

## 13. Monitoring

### Free options (recommended)

| Tool | What it monitors | Install |
|------|-----------------|---------|
| **Netdata** | CPU, RAM, disk, Docker, MongoDB | `docker run -d --name=netdata ...` |
| **UptimeRobot** | HTTPS uptime, cert expiry | cloud, free tier |
| **ctop** | Live container stats | `apt install ctop` |
| **Grafana + Prometheus** | Full metrics stack | docker-compose add-on |

### Quick one-liners

```bash
# Container resource usage
docker stats --no-stream

# Disk usage
df -h && du -sh /var/lib/docker/volumes/*

# MongoDB stats (inside container)
docker compose exec mongodb mongosh \
    -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD \
    --authenticationDatabase admin \
    --eval "db.serverStatus().connections"

# Check all containers are healthy
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
```

### Application health endpoint

```
GET https://yourdomain.com/api/health
→ 200 OK  {"status": "ok"}
```

---

## 14. Logging

Docker logs are stored as JSON files and rotated automatically (configured in `docker-compose.yml`):

- Backend: max 100 MB × 7 files
- Frontend / MongoDB: max 50 MB × 5 files

### View logs

```bash
docker compose logs -f                    # all services
docker compose logs -f backend            # backend only
docker compose logs -f --since 1h backend # last hour
docker compose logs backend 2>&1 | grep ERROR
```

### Nginx access logs (inside frontend container)

```bash
docker compose exec frontend tail -f /var/log/nginx/access.log
docker compose exec frontend tail -f /var/log/nginx/error.log
```

### Persistent log export (optional)

```bash
# Mount a host log directory
# Add to frontend service in docker-compose.yml:
#   volumes:
#     - /var/log/jansetu/nginx:/var/log/nginx
```

---

## 15. Security Hardening

### Already implemented

- JWT authentication on all protected endpoints
- Per-IP in-memory rate limiter on auth endpoints (5 attempts / 5 min)
- MongoDB bound to `127.0.0.1` only (not exposed to internet)
- Nginx security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- Non-root user inside backend container
- File upload path-traversal protection in `storage_util.py`
- Tenant isolation on every query (`tenant_id` filter)
- CORS restricted to configured `CORS_ORIGINS`

### Additional recommendations

```bash
# 1. SSH — disable password auth, use keys only
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 2. Fail2ban — auto-ban brute-force SSH
apt-get install -y fail2ban
systemctl enable fail2ban

# 3. Unattended security upgrades
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades

# 4. MongoDB — create a dedicated read-write user (optional but recommended)
docker compose exec mongodb mongosh \
    -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD \
    --authenticationDatabase admin \
    --eval "
    db.getSiblingDB('jansetu').createUser({
        user: 'jansetu_app',
        pwd: 'STRONG_PASSWORD',
        roles: [{ role: 'readWrite', db: 'jansetu' }]
    })
    "
# Then update MONGO_URL in .env to use jansetu_app credentials
```

---

## 16. Performance Tuning

### Backend

- `WORKERS=3` (or `2 × CPU_CORES + 1`) in `.env`
- All MongoDB queries already use indexes (ensured on startup)
- Motor connection pool: default 100 connections (sufficient to ~500 offices)

### MongoDB

```bash
# Confirm indexes exist
docker compose exec mongodb mongosh \
    -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD \
    --authenticationDatabase admin \
    --eval "db.getSiblingDB('jansetu').issues.getIndexes()"
```

### Nginx

- Gzip enabled for all text types (see `frontend/nginx.conf`)
- Static assets served with `Cache-Control: public, immutable` (1 year)
- HTML served with `no-cache` (ensures users get the latest deploy)
- `http2` enabled on HTTPS listener

### MongoDB WiredTiger cache (for 4 GB RAM VPS)

Add to `config/mongod.conf` and mount in `docker-compose.yml`:

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1   # leave ~3 GB for OS + app
```

---

## 17. Scaling Roadmap

| Offices | Recommended changes |
|---------|---------------------|
| 1–10 | Current setup (1 VPS, 1 MongoDB, local storage) |
| 10–100 | Upgrade VPS to 8 vCPU / 16 GB RAM; add MongoDB replica set for HA |
| 100–500 | Migrate uploads to S3/MinIO; add Redis for FCM cooldown; add Nginx load balancer with 2 backend replicas |
| 500–1000 | Sharded MongoDB cluster; separate background-job workers; CDN for static assets; horizontal backend scaling behind load balancer |

### Near-term additions (no code changes needed)

- **Redis**: `storage_util.py` already reads `REDIS_URL` — set it to enable FCM dedup across multiple backend instances
- **S3**: `storage_util.py` auto-switches to S3 when `S3_BUCKET_NAME` + `AWS_ACCESS_KEY_ID` are set
- **MinIO** (self-hosted S3): set `S3_ENDPOINT_URL=https://minio.yourdomain.com` and the same S3 env vars

---

## 18. Rollback Procedure

### Quick rollback (last known-good commit)

```bash
cd /opt/jansetu
git log --oneline -10         # find the target commit hash
git checkout <COMMIT_HASH>
./scripts/update.sh           # rebuild + restart from that code
```

### Full rollback (code + database)

```bash
# 1. Restore the pre-update backup (interactive)
./scripts/restore.sh /var/backups/jansetu/<TIMESTAMP>

# 2. Check out old code
git checkout <COMMIT_HASH>

# 3. Rebuild + restart
docker compose build && docker compose up -d
```

---

## 19. Troubleshooting

### Backend won't start

```bash
docker compose logs backend | tail -50
# Common causes:
# - MONGO_URL wrong credentials → check .env
# - Port 8000 conflict → another process using it
# - Missing Python package → rebuild: docker compose build backend
```

### MongoDB container unhealthy

```bash
docker compose logs mongodb | tail -30
# Common causes:
# - Wrong MONGO_ROOT_PASSWORD (changed after volume was created)
# - Disk full: df -h
```

### SSL certificate errors

```bash
certbot certificates          # check expiry
certbot renew --force-renewal # force renew
docker compose restart frontend
```

### Push notifications not delivered

```bash
# Check FCM mode
curl https://yourdomain.com/api/push/status
# Should return: {"mode": "fcm", "fcm_configured": true}

# Check firebase-admin.json is mounted
docker compose exec backend ls /app/secrets/
```

### File uploads failing

```bash
# Check uploads volume is mounted
docker compose exec backend ls /var/data/jansetu/uploads/

# Check disk space
df -h
docker system df
```

### After a VPS reboot

Docker Compose and its containers start automatically (restart policies are `unless-stopped`). Verify with:

```bash
docker compose ps
```

---

*Last updated: July 2025 — covers Tasks #4 (auth), #6 (storage), #7 (push), #18 (worker alerts), #19 (bulk-resolve flood protection)*
