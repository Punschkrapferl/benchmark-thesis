#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMON_COUNT_SCRIPT="${SCRIPT_DIR}/../common/count-todos.sh"

"${COMMON_COUNT_SCRIPT}" \
  "FastAPI" \
  "todo_fastapi"