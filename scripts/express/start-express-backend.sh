#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_START_SCRIPT="${SCRIPT_DIR}/../common/start-backend.sh"

"${COMMON_START_SCRIPT}" \
  "Express" \
  "express" \
  "http://127.0.0.1:3001" \
  "/todos" \
  30 \
  2