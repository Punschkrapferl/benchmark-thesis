#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

# Optional custom base URLs.
# Defaults match the local docker-compose setup.
EXPRESS_BASE_URL="${1:-http://127.0.0.1:3001}"
FASTAPI_BASE_URL="${2:-http://127.0.0.1:8082}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_SCRIPT="${SCRIPT_DIR}/common/compare-with-express-parity.sh"

"${COMMON_SCRIPT}" \
  "FastAPI" \
  "${EXPRESS_BASE_URL}" \
  "${FASTAPI_BASE_URL}" \
  "scripts/fastapi/reset-fastapi-db.sh"
