#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
STATE="${2:-}"
RESET_SCRIPT="${3:-}"
SEED_SCRIPT="${4:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${STATE}" || -z "${RESET_SCRIPT}" || -z "${SEED_SCRIPT}" ]]; then
  echo "Usage: $0 <display-name> <state> <reset-script> <seed-script>"
  exit 1
fi

# Verify that the required helper scripts exist before starting.
for helper_script in "${RESET_SCRIPT}" "${SEED_SCRIPT}"; do
  if [[ ! -f "${helper_script}" ]]; then
    echo "Required helper script not found: ${helper_script}"
    exit 1
  fi
done

# Reset the backend benchmark database to a clean state.
"${RESET_SCRIPT}"

# Seed the backend benchmark database with the selected benchmark state.
"${SEED_SCRIPT}" "${STATE}"

echo "Reset and seed completed for ${DISPLAY_NAME} state '${STATE}'."