#!/usr/bin/env bash

# Shared parity comparison runner.
#
# Compares one backend (ASP.NET, FastAPI, or Spring Boot) against the Express
# reference backend. The same set of HTTP test cases, the same response
# normalization rules, and the same seed setup are used regardless of which
# backend is being compared.
#
# Each per-backend wrapper in scripts/ provides only the values that genuinely
# differ between pairs: the backend label, the backend base URL, and the
# relative path of the backend's reset script.
#
# Exit code:
# - 0 means all parity cases passed
# - 1 means at least one parity case failed
#
# Stop on errors, undefined variables, and failed pipeline parts.
set -euo pipefail

BACKEND_LABEL="${1:-}"
EXPRESS_BASE_URL="${2:-}"
BACKEND_BASE_URL="${3:-}"
BACKEND_RESET_SCRIPT="${4:-}"

if [[ -z "${BACKEND_LABEL}" || -z "${EXPRESS_BASE_URL}" || -z "${BACKEND_BASE_URL}" || -z "${BACKEND_RESET_SCRIPT}" ]]; then
  echo "Usage: $0 <backend-label> <express-base-url> <backend-base-url> <backend-reset-script>"
  exit 1
fi

# The Express reset script is fixed because Express is the parity reference.
EXPRESS_RESET_SCRIPT="scripts/express/reset-express-db.sh"
EXPRESS_SEED_SCRIPT="scripts/express/seed-express-db-state.sh"

# Resolve the project root and run from there so all relative paths
# (reset scripts, docker compose) work regardless of the caller's cwd.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${PROJECT_ROOT}"

# Temporary directory for intermediate response files.
# It is removed automatically when the script exits.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# Seeded IDs are captured dynamically because the concrete ID values may
# differ between Express and the compared backend.
EXPRESS_SEED_ID_1=""
EXPRESS_SEED_ID_2=""
BACKEND_SEED_ID_1=""
BACKEND_SEED_ID_2=""

# Deterministic seed payloads sent to both backends.
SEED_PAYLOAD_1='{"title":"seed-one","completed":false,"order":1}'
SEED_PAYLOAD_2='{"title":"seed-two","completed":true,"order":2}'

# All cases run; failures are collected and reported at the end.
FAILED_CASE_COUNT=0
FAILED_CASES=()

print_section() {
  local title="$1"

  echo
  echo "=================================================="
  echo "${title}"
  echo "=================================================="
}

record_failed_case() {
  FAILED_CASE_COUNT=$((FAILED_CASE_COUNT + 1))
  FAILED_CASES+=("$1")
}

print_parity_summary_and_exit() {
  print_section "Parity result"

  if [[ "${FAILED_CASE_COUNT}" -eq 0 ]]; then
    echo "All parity cases passed."
    exit 0
  fi

  echo "Parity check failed."
  echo "Failed case count: ${FAILED_CASE_COUNT}"
  echo
  echo "Failed cases:"

  for failed_case in "${FAILED_CASES[@]}"; do
    echo " - ${failed_case}"
  done

  exit 1
}

sanitize_name() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's#[ /:]#_#g' \
    | sed 's#[^a-z0-9_-]##g' \
    | sed 's#_\{2,\}#_#g' \
    | sed 's#^_##' \
    | sed 's#_$##'
}

# Replace placeholder tokens in path templates with the IDs that were captured
# from each backend during the seed step. This lets the same logical case
# target matching seeded resources even though the ID values differ.
resolve_path_for_target() {
  local target="$1"
  local path_template="$2"
  local resolved="${path_template}"

  if [[ "${target}" == "express" ]]; then
    resolved="${resolved//\{\{seed_1\}\}/${EXPRESS_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${EXPRESS_SEED_ID_2}}"
  elif [[ "${target}" == "backend" ]]; then
    resolved="${resolved//\{\{seed_1\}\}/${BACKEND_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${BACKEND_SEED_ID_2}}"
  else
    echo "Unsupported parity target: ${target}"
    exit 1
  fi

  printf '%s' "${resolved}"
}

# Extract the numeric "id" field from a simple JSON object response.
# This is sufficient for the create-todo responses used during seeding.
extract_json_id() {
  printf '%s' "$1" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p'
}

extract_status_code() {
  head -n 1 "$1" | sed -E 's/^HTTP\/[0-9.]+ ([0-9]{3}).*$/\1/'
}

# Send one HTTP request and split the response into raw, headers, and body
# files. The raw split avoids parsing curl output twice.
perform_request() {
  local label="$1"
  local method="$2"
  local url="$3"
  local body="${4:-}"
  local output_prefix="$5"

  local raw_file="${output_prefix}.raw"
  local headers_file="${output_prefix}.headers"
  local body_file="${output_prefix}.body"

  if [[ -n "${body}" ]]; then
    curl -sS -i -X "${method}" \
      -H "Content-Type: application/json" \
      -d "${body}" \
      "${url}" > "${raw_file}"
  else
    curl -sS -i -X "${method}" \
      "${url}" > "${raw_file}"
  fi

  awk 'BEGIN{in_body=0} /^\r?$/{in_body=1; next} {if(!in_body) print}' "${raw_file}" > "${headers_file}"
  awk 'BEGIN{in_body=0} /^\r?$/{in_body=1; next} {if(in_body) print}' "${raw_file}" > "${body_file}"

  echo "[${label}]"
  echo "URL: ${url}"
  echo
  echo "-- Headers --"
  cat "${headers_file}"
  echo
  echo "-- Body --"
  cat "${body_file}"
  echo
}

# Normalize headers before comparison.
#
# - The first line is skipped because the numeric status code is compared separately.
# - Transport-specific or unstable headers are removed.
# - JSON content-type variants are collapsed to a single form.
# - Location headers are lowercased to avoid casing differences.
normalize_headers() {
  awk '
    NR == 1 { next }

    {
      sub(/\r$/, "", $0)
      lower = tolower($0)

      if (lower ~ /^date:/) next
      if (lower ~ /^transfer-encoding:/) next
      if (lower ~ /^content-length:/) next
      if (lower ~ /^connection:/) next
      if (lower ~ /^keep-alive:/) next
      if (lower ~ /^server:/) next

      if (lower ~ /^content-type: application\/json; charset=utf-8$/) {
        print "content-type: application/json"
        next
      }

      if (lower ~ /^content-type: application\/json$/) {
        print "content-type: application/json"
        next
      }

      if (lower ~ /^location:/) {
        print lower
        next
      }

      print lower
    }
  ' "$1" | sort
}

# Replace each backend's base URL with a placeholder so only semantic body
# differences remain after diffing.
normalize_body() {
  sed \
    -e "s#${EXPRESS_BASE_URL}#<BASE_URL>#g" \
    -e "s#${BACKEND_BASE_URL}#<BASE_URL>#g" \
    "$1"
}

# Canonicalize JSON bodies so list field order and whitespace do not cause
# false mismatches between frameworks.
canonicalize_json_body() {
  local input_file="$1"
  local output_file="$2"

  python3 - "${input_file}" "${output_file}" <<'PY'
import json
import sys

input_path, output_path = sys.argv[1], sys.argv[2]
text = open(input_path, encoding="utf-8").read().strip()

if text == "":
    open(output_path, "w", encoding="utf-8").write("")
    sys.exit(0)

data = json.loads(text)

if isinstance(data, list):
    data = sorted(data, key=lambda item: item.get("id", 0))
    data = [
        {key: item[key] for key in ("id", "title", "completed", "order", "url") if key in item}
        for item in data
    ]
elif isinstance(data, dict) and "id" in data:
    data = {
        key: data[key]
        for key in ("id", "title", "completed", "order", "url")
        if key in data
    }

open(output_path, "w", encoding="utf-8").write(
    json.dumps(data, separators=(",", ":"), ensure_ascii=False)
)
PY
}

# Compare one logical case across Express and the target backend.
# A case fails if status, normalized headers, or normalized body differ.
compare_case() {
  local name="$1"
  local method="$2"
  local path_template="$3"
  local body="${4:-}"

  local case_failed=0

  local safe_name
  safe_name="$(sanitize_name "${name}")"

  local express_prefix="${TMP_DIR}/${safe_name}_express"
  local backend_prefix="${TMP_DIR}/${safe_name}_backend"

  local express_path
  local backend_path
  express_path="$(resolve_path_for_target express "${path_template}")"
  backend_path="$(resolve_path_for_target backend "${path_template}")"

  print_section "${name}"

  perform_request "${name} - Express" "${method}" "${EXPRESS_BASE_URL}${express_path}" "${body}" "${express_prefix}"
  perform_request "${name} - ${BACKEND_LABEL}" "${method}" "${BACKEND_BASE_URL}${backend_path}" "${body}" "${backend_prefix}"

  local express_status_code
  local backend_status_code
  express_status_code="$(extract_status_code "${express_prefix}.headers")"
  backend_status_code="$(extract_status_code "${backend_prefix}.headers")"

  local express_headers_norm="${express_prefix}.headers.norm"
  local backend_headers_norm="${backend_prefix}.headers.norm"
  local express_body_norm="${express_prefix}.body.norm"
  local backend_body_norm="${backend_prefix}.body.norm"
  local express_body_tmp="${express_prefix}.body.tmp"
  local backend_body_tmp="${backend_prefix}.body.tmp"

  normalize_headers "${express_prefix}.headers" > "${express_headers_norm}"
  normalize_headers "${backend_prefix}.headers" > "${backend_headers_norm}"

  normalize_body "${express_prefix}.body" > "${express_body_tmp}"
  normalize_body "${backend_prefix}.body" > "${backend_body_tmp}"
  canonicalize_json_body "${express_body_tmp}" "${express_body_norm}"
  canonicalize_json_body "${backend_body_tmp}" "${backend_body_norm}"

  echo "-- Comparison --"

  if [[ "${express_status_code}" == "${backend_status_code}" ]]; then
    echo "Status: MATCH (${express_status_code})"
  else
    echo "Status: DIFFERENT"
    echo "  Express: ${express_status_code}"
    echo "  ${BACKEND_LABEL}: ${backend_status_code}"
    case_failed=1
  fi

  if diff -u "${express_headers_norm}" "${backend_headers_norm}" > /dev/null; then
    echo "Headers: MATCH"
  else
    echo "Headers: DIFFERENT"
    diff -u "${express_headers_norm}" "${backend_headers_norm}" || true
    case_failed=1
  fi

  if diff -u "${express_body_norm}" "${backend_body_norm}" > /dev/null; then
    echo "Body: MATCH"
  else
    echo "Body: DIFFERENT"
    diff -u "${express_body_norm}" "${backend_body_norm}" || true
    case_failed=1
  fi

  if [[ "${case_failed}" -eq 0 ]]; then
    echo "Case result: PASS"
  else
    echo "Case result: FAIL"
    record_failed_case "${name}"
  fi
}

# Wait until one backend is reachable.
# This avoids failing immediately when Docker reports the container as started
# but the application inside it is not ready yet.
check_url_ready() {
  local label="$1"
  local base_url="$2"
  local max_attempts=30
  local sleep_seconds=2

  echo "Waiting for ${label} at ${base_url} ..."

  for attempt in $(seq 1 "${max_attempts}"); do
    if curl -fsS "${base_url}/todos" > /dev/null 2>&1; then
      echo "${label} is reachable."
      return 0
    fi

    echo "${label} not ready yet, attempt ${attempt}/${max_attempts} ..."
    sleep "${sleep_seconds}"
  done

  echo "${label} is not reachable at ${base_url}"
  return 1
}

check_backends_ready() {
  print_section "Checking backend availability"

  if ! check_url_ready "Express backend" "${EXPRESS_BASE_URL}"; then
    exit 1
  fi

  if ! check_url_ready "${BACKEND_LABEL} backend" "${BACKEND_BASE_URL}"; then
    exit 1
  fi

  echo "Both backends are reachable."
}

post_seed_row() {
  local base_url="$1"
  local payload="$2"

  curl -sS -X POST "${base_url}/todos" \
    -H "Content-Type: application/json" \
    -d "${payload}"
}

# Reset both backend databases and seed two deterministic rows per backend.
# Captures the returned IDs so later cases can target the same seeded rows.
seed_test_data() {
  print_section "Preparing clean test state"

  ./"${EXPRESS_RESET_SCRIPT}"
  ./"${BACKEND_RESET_SCRIPT}"

  local express_seed_1_json
  local express_seed_2_json
  local backend_seed_1_json
  local backend_seed_2_json

  express_seed_1_json="$(post_seed_row "${EXPRESS_BASE_URL}" "${SEED_PAYLOAD_1}")"
  express_seed_2_json="$(post_seed_row "${EXPRESS_BASE_URL}" "${SEED_PAYLOAD_2}")"
  backend_seed_1_json="$(post_seed_row "${BACKEND_BASE_URL}" "${SEED_PAYLOAD_1}")"
  backend_seed_2_json="$(post_seed_row "${BACKEND_BASE_URL}" "${SEED_PAYLOAD_2}")"

  EXPRESS_SEED_ID_1="$(extract_json_id "${express_seed_1_json}")"
  EXPRESS_SEED_ID_2="$(extract_json_id "${express_seed_2_json}")"
  BACKEND_SEED_ID_1="$(extract_json_id "${backend_seed_1_json}")"
  BACKEND_SEED_ID_2="$(extract_json_id "${backend_seed_2_json}")"

  if [[ -z "${EXPRESS_SEED_ID_1}" || -z "${EXPRESS_SEED_ID_2}" || -z "${BACKEND_SEED_ID_1}" || -z "${BACKEND_SEED_ID_2}" ]]; then
    echo "Failed to capture seeded IDs."
    exit 1
  fi

  echo "Express seeded IDs: ${EXPRESS_SEED_ID_1}, ${EXPRESS_SEED_ID_2}"
  echo "${BACKEND_LABEL} seeded IDs: ${BACKEND_SEED_ID_1}, ${BACKEND_SEED_ID_2}"
}

# Reset both databases and seed the shared small benchmark state (100 rows).
# Pagination cases rely on ids 1-100 with deterministic titles and order values.
prepare_pagination_test_data() {
  print_section "Preparing pagination test state (small / 100 rows)"

  local backend_scripts_dir
  local backend_name
  local backend_seed_script

  backend_scripts_dir="$(dirname "${BACKEND_RESET_SCRIPT}")"
  backend_name="$(basename "${backend_scripts_dir}")"
  backend_seed_script="${backend_scripts_dir}/seed-${backend_name}-db-state.sh"

  if [[ ! -f "${backend_seed_script}" ]]; then
    echo "Backend seed script not found: ${backend_seed_script}"
    exit 1
  fi

  ./"${EXPRESS_RESET_SCRIPT}"
  ./"${EXPRESS_SEED_SCRIPT}" small

  ./"${BACKEND_RESET_SCRIPT}"
  ./"${backend_seed_script}" small

  echo "Both databases seeded with small state (100 rows, ids 1-100)."
}

main() {
  print_section "Parity comparison"
  echo "Express base URL: ${EXPRESS_BASE_URL}"
  echo "${BACKEND_LABEL} base URL: ${BACKEND_BASE_URL}"

  check_backends_ready
  seed_test_data

  compare_case "GET /todos" "GET" "/todos"
  compare_case "GET existing todo" "GET" "/todos/{{seed_1}}"
  compare_case "GET /todos/abc" "GET" "/todos/abc"
  compare_case "GET unknown route" "GET" "/does-not-exist"

  compare_case "POST valid todo" "POST" "/todos" '{"title":"hello","completed":false,"order":5}'
  compare_case "POST invalid completed null" "POST" "/todos" '{"title":"test","completed":null}'
  compare_case "POST malformed JSON" "POST" "/todos" '{"title":'
  compare_case "POST unknown field" "POST" "/todos" '{"title":"hello","completed":false,"unknown":123}'
  compare_case "POST body array" "POST" "/todos" '[]'
  compare_case "POST title wrong type" "POST" "/todos" '{"title":123}'

  compare_case "PATCH existing todo order null" "PATCH" "/todos/{{seed_1}}" '{"order":null}'
  compare_case "PATCH invalid field on existing todo" "PATCH" "/todos/{{seed_1}}" '{"unknown":123}'
  compare_case "PATCH invalid id" "PATCH" "/todos/abc" '{"title":"x"}'
  compare_case "PATCH title null" "PATCH" "/todos/{{seed_1}}" '{"title":null}'
  compare_case "PATCH completed null" "PATCH" "/todos/{{seed_1}}" '{"completed":null}'
  compare_case "PATCH body array" "PATCH" "/todos/{{seed_1}}" '[]'

  compare_case "DELETE existing todo" "DELETE" "/todos/{{seed_2}}"
  compare_case "DELETE unknown id" "DELETE" "/todos/999999"
  compare_case "DELETE invalid id" "DELETE" "/todos/abc"

  compare_case "DELETE /todos" "DELETE" "/todos"
  compare_case "GET /todos after delete all" "GET" "/todos"

  prepare_pagination_test_data

  compare_case "GET /todos paged limit only" "GET" "/todos?limit=10"
  compare_case "GET /todos paged limit afterId" "GET" "/todos?limit=10&afterId=20"
  compare_case "GET /todos paged afterId only" "GET" "/todos?afterId=50"
  compare_case "GET /todos paged limit cap" "GET" "/todos?limit=1000"
  compare_case "GET /todos paged invalid limit" "GET" "/todos?limit=abc"
  compare_case "GET /todos paged negative afterId" "GET" "/todos?afterId=-1"
  compare_case "GET /todos paged empty page" "GET" "/todos?limit=10&afterId=99999"
  compare_case "GET /todos benchmark page" "GET" "/todos?limit=100&afterId=0"

  print_parity_summary_and_exit
}

main "$@"
