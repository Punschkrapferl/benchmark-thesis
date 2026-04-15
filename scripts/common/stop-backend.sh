#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
SERVICE_NAME="${2:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${SERVICE_NAME}" ]]; then
  echo "Usage: $0 <display-name> <service-name>"
  exit 1
fi

# Resolve the project root so docker compose is always executed
# from the repository root regardless of the current shell directory.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${PROJECT_ROOT}"

echo "Stopping ${DISPLAY_NAME} backend via Docker Compose..."

# Stop only the backend service.
# The shared postgres container is intentionally left running.
docker compose stop "${SERVICE_NAME}"

echo "${DISPLAY_NAME} backend stopped."