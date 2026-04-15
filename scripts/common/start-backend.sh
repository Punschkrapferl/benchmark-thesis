#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
SERVICE_NAME="${2:-}"
BASE_URL="${3:-}"
HEALTH_ENDPOINT="${4:-}"
ATTEMPTS="${5:-30}"
SLEEP_SECONDS="${6:-2}"

if [[ -z "${DISPLAY_NAME}" || -z "${SERVICE_NAME}" || -z "${BASE_URL}" || -z "${HEALTH_ENDPOINT}" ]]; then
  echo "Usage: $0 <display-name> <service-name> <base-url> <health-endpoint> [attempts] [sleep-seconds]"
  exit 1
fi

# Resolve the project root so docker compose is always executed
# from the repository root regardless of the current shell directory.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${PROJECT_ROOT}"

echo "Starting ${DISPLAY_NAME} backend via Docker Compose..."

# Start both the shared database and the requested backend service.
# Using Compose for all backends keeps runtime management consistent.
docker compose up -d postgres "${SERVICE_NAME}"

echo "Waiting for ${DISPLAY_NAME} backend to become reachable..."

for ((i=1; i<=ATTEMPTS; i++)); do
  if curl -fsS "${BASE_URL}${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
    echo "${DISPLAY_NAME} backend is ready at ${BASE_URL}${HEALTH_ENDPOINT}"
    exit 0
  fi

  echo "Attempt ${i}/${ATTEMPTS} failed. Retrying in ${SLEEP_SECONDS}s..."
  sleep "${SLEEP_SECONDS}"
done

echo "${DISPLAY_NAME} backend did not become reachable in time."
echo "Last container log lines:"
docker compose logs --tail=50 "${SERVICE_NAME}" || true
exit 1