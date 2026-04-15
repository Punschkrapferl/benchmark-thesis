#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

# Optional verification parameters:
# - benchmark state to seed
# - base URL of the backend
# - endpoint used for readiness and smoke checks
STATE="${1:-small}"
BASE_URL="${2:-http://127.0.0.1:8082}"
BENCH_HEALTH_ENDPOINT="${3:-/todos}"

# Resolve the directory of this wrapper so helper paths remain stable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_VERIFY_SCRIPT="${SCRIPT_DIR}/../common/verify-backend-cycle.sh"

"${COMMON_VERIFY_SCRIPT}" \
  "FastAPI" \
  "${STATE}" \
  "${BASE_URL}" \
  "${BENCH_HEALTH_ENDPOINT}" \
  "${SCRIPT_DIR}/reset-and-seed-fastapi-db-state.sh" \
  "${SCRIPT_DIR}/count-fastapi-todos.sh" \
  "${SCRIPT_DIR}/start-fastapi-backend.sh"