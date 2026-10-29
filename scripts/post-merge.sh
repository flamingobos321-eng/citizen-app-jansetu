#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Preserve the Python/FastAPI runtime. Never seed, migrate, or push a DB here.
bash scripts/install-python.sh
