#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
DATABASE_NAME="${2:-}"
RESET_SQL_FILE="${3:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${DATABASE_NAME}" || -z "${RESET_SQL_FILE}" ]]; then
  echo "Usage: $0 <display-name> <database-name> <reset-sql-file>"
  exit 1
fi

if [[ ! -f "${RESET_SQL_FILE}" ]]; then
  echo "Reset SQL file not found: ${RESET_SQL_FILE}"
  exit 1
fi

# Resolve the project root so the SQL reset file can be referenced
# reliably regardless of the current working directory.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Run the script from the project root so docker compose uses
# the correct compose file and paths.
cd "${PROJECT_ROOT}"

echo "Resetting ${DISPLAY_NAME} database '${DATABASE_NAME}'..."

# Execute the shared reset SQL script inside the PostgreSQL container.
#
# -d <database>      -> connect directly to the backend benchmark database
# -v ON_ERROR_STOP=1 -> abort immediately if any SQL statement fails
# -f /dev/stdin      -> read SQL input from the reset SQL file via stdin
# The PostgreSQL username is read from the running container environment.
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -f /dev/stdin' \
  _ "${DATABASE_NAME}" < "${RESET_SQL_FILE}"

echo "Reset completed for ${DISPLAY_NAME} database '${DATABASE_NAME}'."