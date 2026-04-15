#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
STATE="${2:-}"
BASE_URL="${3:-}"
BENCH_HEALTH_ENDPOINT="${4:-}"
RESET_AND_SEED_SCRIPT="${5:-}"
COUNT_SCRIPT="${6:-}"
START_SCRIPT="${7:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${STATE}" || -z "${BASE_URL}" || -z "${BENCH_HEALTH_ENDPOINT}" || -z "${RESET_AND_SEED_SCRIPT}" || -z "${COUNT_SCRIPT}" || -z "${START_SCRIPT}" ]]; then
  echo "Usage: $0 <display-name> <state> <base-url> <health-endpoint> <reset-and-seed-script> <count-script> <start-script>"
  exit 1
fi

# Verify that the required helper scripts exist before starting the cycle.
for helper_script in "${RESET_AND_SEED_SCRIPT}" "${COUNT_SCRIPT}" "${START_SCRIPT}"; do
  if [[ ! -f "${helper_script}" ]]; then
    echo "Required helper script not found: ${helper_script}"
    exit 1
  fi
done

# Resolve the project root so docker compose is always executed
# from the repository root regardless of the current shell directory.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Run the script from the project root so relative tooling paths stay stable.
cd "${PROJECT_ROOT}"

echo "--------------------------------------------------"
echo "${DISPLAY_NAME} verification cycle"
echo "State      : ${STATE}"
echo "Base URL   : ${BASE_URL}"
echo "Health path: ${BENCH_HEALTH_ENDPOINT}"
echo "--------------------------------------------------"

echo
echo "[0/5] Start shared PostgreSQL service..."
docker compose up -d postgres

echo
echo "[1/5] Reset and seed database..."
"${RESET_AND_SEED_SCRIPT}" "${STATE}"

echo
echo "[2/5] Count rows after seeding..."
"${COUNT_SCRIPT}"

echo
echo "[3/5] Start ${DISPLAY_NAME} backend and wait for readiness..."
"${START_SCRIPT}"

echo
echo "[4/5] Smoke check response headers..."
curl -i "${BASE_URL}${BENCH_HEALTH_ENDPOINT}"

echo
echo "[5/5] Verification completed."
echo "${DISPLAY_NAME} reset-seed-start cycle completed successfully."