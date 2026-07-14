# Deploying JANSETU on Hostinger VPS

## Prerequisites

- Ubuntu 24.04 LTS VPS
- Docker + Docker Compose installed
- Domain name pointed at your VPS IP
- Port 80 and 443 open in the VPS firewall

## First-time setup

### 1. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Re-login for the group change to take effect
```

### 2. Clone and configure

```bash
git clone https://github.com/YOUR_ORG/jansetu.git
cd jansetu

# Create your .env file from the template
cp .env.example .env
nano .env   # fill in real values
```

### 3. Set your domain in the Nginx config

```bash
# Replace YOUR_DOMAIN in the nginx config
sed -i 's/YOUR_DOMAIN/yourdomain.com/g' frontend/nginx.conf
```

### 4. Obtain an SSL certificate (Let's Encrypt)

Do this **before** enabling the HTTPS redirect in nginx.conf. Start Nginx in HTTP-only mode:

```bash
# Temporarily comment out the HTTP→HTTPS redirect in frontend/nginx.conf
# (the `return 301` line) and rebuild:
docker compose build frontend
docker compose up -d

# Then get the certificate
sudo apt install certbot
sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com

# Re-enable the redirect (uncomment the return 301 line), rebuild and restart
docker compose build frontend
docker compose up -d frontend
```

### 5. Build and start all services

```bash
docker compose build
docker compose up -d
```

### 6. Verify

```bash
docker compose ps          # all containers should be Up
docker compose logs -f     # watch logs
curl https://yourdomain.com/api/health  # should return {"status":"ok"}
```

---

## Ongoing deployments (git pull → rebuild)

```bash
git pull
docker compose build
docker compose up -d
```

Or add this as a deploy script:

```bash
#!/bin/bash
set -e
git pull origin main
docker compose build --no-cache
docker compose up -d
docker compose ps
```

---

## Certificate renewal

Certbot auto-renews certificates. Add a cron job to reload Nginx after renewal:

```bash
sudo crontab -e
# Add:
0 3 * * * certbot renew --quiet && docker compose -f /path/to/jansetu/docker-compose.yml exec frontend nginx -s reload
```

---

## Useful commands

```bash
# View logs
docker compose logs backend --tail=100 -f
docker compose logs frontend --tail=100 -f

# Restart a single service
docker compose restart backend

# Open a MongoDB shell
docker compose exec mongodb mongosh -u admin -p

# Backup MongoDB
docker compose exec mongodb mongodump --out /data/backup
docker cp $(docker compose ps -q mongodb):/data/backup ./backup-$(date +%Y%m%d)
```
