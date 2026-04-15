#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
DATABASE_NAME="${2:-}"
STATE="${3:-}"
SEED_STATES_DIR="${4:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${DATABASE_NAME}" || -z "${STATE}" || -z "${SEED_STATES_DIR}" ]]; then
  echo "Usage: $0 <display-name> <database-name> <state> <seed-states-dir>"
  exit 1
fi

# Reject unsupported state names early to avoid accidental misuse.
case "${STATE}" in
  empty|small|medium|large)
    ;;
  *)
    echo "Invalid state: ${STATE}"
    echo "Allowed states: empty, small, medium, large"
    exit 1
    ;;
esac

SQL_FILE="${SEED_STATES_DIR}/${STATE}.sql"

# Abort if the expected seed file does not exist.
if [[ ! -f "${SQL_FILE}" ]]; then
  echo "Seed file not found: ${SQL_FILE}"
  exit 1
fi

# Resolve the project root so docker compose uses
# the correct compose file and paths.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${PROJECT_ROOT}"

echo "Seeding ${DISPLAY_NAME} database '${DATABASE_NAME}' with state '${STATE}'..."

# Execute the selected benchmark seed file inside the PostgreSQL container.
#
# -d <database>      -> connect to the backend benchmark database
# -v ON_ERROR_STOP=1 -> abort immediately if any SQL statement fails
# -f /dev/stdin      -> read SQL input from the selected seed file via stdin
# The PostgreSQL username is read from the running container environment.
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -f /dev/stdin' \
  _ "${DATABASE_NAME}" < "${SQL_FILE}"

echo "Seed completed for ${DISPLAY_NAME} state '${STATE}'."