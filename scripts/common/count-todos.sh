#!/usr/bin/env bash

# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

DISPLAY_NAME="${1:-}"
DATABASE_NAME="${2:-}"

if [[ -z "${DISPLAY_NAME}" || -z "${DATABASE_NAME}" ]]; then
  echo "Usage: $0 <display-name> <database-name>"
  exit 1
fi

# Resolve the project root so docker compose is executed
# from the correct directory.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Run the script from the project root so docker compose uses
# the correct compose file and paths.
cd "${PROJECT_ROOT}"

echo "Counting rows in ${DISPLAY_NAME} database '${DATABASE_NAME}'..."

# Run psql inside the PostgreSQL container and print only the raw row count.
#
# -t -> remove headers and footers
# -A -> disable aligned table formatting
# The PostgreSQL username is read from the running container environment.
docker compose exec -T postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$1" -t -A -c "SELECT COUNT(*) FROM todos;"' \
  _ "${DATABASE_NAME}"