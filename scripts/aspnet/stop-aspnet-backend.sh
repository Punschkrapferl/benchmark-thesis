#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_STOP_SCRIPT="${SCRIPT_DIR}/../common/stop-backend.sh"

"${COMMON_STOP_SCRIPT}" \
  "ASP.NET" \
  "aspnet"