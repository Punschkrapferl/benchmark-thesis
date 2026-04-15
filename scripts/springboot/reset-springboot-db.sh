#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMMON_RESET_SCRIPT="${SCRIPT_DIR}/../common/reset-db.sh"

"${COMMON_RESET_SCRIPT}" \
  "Spring Boot" \
  "todo_springboot" \
  "${PROJECT_ROOT}/db/reset/reset_todos.sql"