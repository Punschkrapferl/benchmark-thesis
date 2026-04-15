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
COMMON_SCRIPT="${SCRIPT_DIR}/../common/reset-and-seed-db-state.sh"

"${COMMON_SCRIPT}" \
  "ASP.NET" \
  "${STATE}" \
  "${SCRIPT_DIR}/reset-aspnet-db.sh" \
  "${SCRIPT_DIR}/seed-aspnet-db-state.sh"