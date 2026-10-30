---
name: GitHub source of truth
description: JanSetu's GitHub-to-VPS deployment boundary and shared-infrastructure constraints.
---

**Rule:** GitHub is the only source of truth for JanSetu code. Development changes are committed and pushed from Replit; the VPS pulls the latest stable code and runs `./scripts/deploy.sh`. VPS edits are limited to environment variables and deployment. JanSetu remains a separate Docker Compose project with its own containers, volumes, environment, and database. Nginx Proxy Manager is the only reverse proxy and owns SSL; JanSetu must not modify shared services or bind ports 80/443.

**Why:** the user explicitly specified this deployment workflow to coexist safely with the existing VianBills service.

**How to apply:** push tested code to GitHub and write deployment instructions for pulling and deploying it. Keep JanSetu's Compose resources isolated and configure only its internal frontend/backend proxy targets in Nginx Proxy Manager.
