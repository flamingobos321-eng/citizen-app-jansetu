#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Use Replit's managed Python package directory, not a new .venv.
UV_PROJECT_ENVIRONMENT="$PWD/.pythonlibs" uv sync --frozen
