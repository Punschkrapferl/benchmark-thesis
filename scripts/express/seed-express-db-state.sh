#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

# Benchmark state passed as the first script argument.
# Allowed values: empty, small, medium, large.
STATE="${1:-}"

# Abort if no state was provided.
if [[ -z "${STATE}" ]]; then
  echo "Usage: $0 <empty|small|medium|large>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMMON_SEED_SCRIPT="${SCRIPT_DIR}/../common/seed-db-state.sh"

"${COMMON_SEED_SCRIPT}" \
  "Express" \
  "todo_express" \
  "${STATE}" \
  "${PROJECT_ROOT}/db/seed/states"