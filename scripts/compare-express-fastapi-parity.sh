#!/usr/bin/env bash

# Exit immediately on:
# - any command failure
# - use of an undefined variable
# - failure inside a pipeline
set -euo pipefail

# Optional custom base URLs.
# Defaults match the local docker-compose / thesis setup.
EXPRESS_BASE_URL="${1:-http://127.0.0.1:3001}"
FASTAPI_BASE_URL="${2:-http://127.0.0.1:8082}"

# Temporary directory for intermediate response files.
# It is removed automatically when the script exits.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# These variables store the real seeded IDs returned by each backend.
# The IDs are captured dynamically because the concrete ID values may differ
# between backend databases.
EXPRESS_SEED_ID_1=""
EXPRESS_SEED_ID_2=""
FASTAPI_SEED_ID_1=""
FASTAPI_SEED_ID_2=""

# Track whether any parity case failed.
# The script does not stop at the first mismatch.
# Instead, it runs all cases, collects failures, and exits with code 1 at the end
# if at least one mismatch was detected.
FAILED_CASE_COUNT=0
FAILED_CASES=()

# Print a visual section header.
print_section() {
  local title="$1"

  echo
  echo "=================================================="
  echo "${title}"
  echo "=================================================="
}

# Store the name of a failed parity case.
record_failed_case() {
  local name="$1"

  FAILED_CASE_COUNT=$((FAILED_CASE_COUNT + 1))
  FAILED_CASES+=("${name}")
}

# Print the final parity result.
# Exit code:
# - 0 means all parity cases passed
# - 1 means at least one parity case failed
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

# Turn a human-readable test name into a safe filename fragment.
sanitize_name() {
  local raw="$1"

  printf '%s' "${raw}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's#[ /:]#_#g' \
    | sed 's#[^a-z0-9_-]##g' \
    | sed 's#_\{2,\}#_#g' \
    | sed 's#^_##' \
    | sed 's#_$##'
}

# Replace path placeholders with the real seeded IDs.
# This allows the same logical test case to target matching seeded resources
# even if the generated IDs differ between backend databases.
resolve_path_for_backend() {
  local backend="$1"
  local path_template="$2"

  local resolved="${path_template}"

  if [[ "${backend}" == "express" ]]; then
    resolved="${resolved//\{\{seed_1\}\}/${EXPRESS_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${EXPRESS_SEED_ID_2}}"
  elif [[ "${backend}" == "fastapi" ]]; then
    resolved="${resolved//\{\{seed_1\}\}/${FASTAPI_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${FASTAPI_SEED_ID_2}}"
  else
    echo "Unsupported backend for path resolution: ${backend}"
    exit 1
  fi

  printf '%s' "${resolved}"
}

# Extract the numeric "id" field from a simple JSON response.
extract_json_id() {
  local json="$1"

  printf '%s' "${json}" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p'
}

# Extract only the numeric HTTP status code from the first response line.
# Examples:
#   HTTP/1.1 200 OK -> 200
#   HTTP/1.1 201    -> 201
extract_status_code() {
  local headers_file="$1"

  head -n 1 "${headers_file}" | sed -E 's/^HTTP\/[0-9.]+ ([0-9]{3}).*$/\1/'
}

# Send one HTTP request and save:
# - full raw response
# - headers only
# - body only
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

  # Split raw curl response into headers and body.
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
# Important:
# - The first line is skipped because the numeric status code is compared separately.
# - Transport-specific or unstable headers are removed.
# - JSON content-type variants are normalized.
# - Location headers are lowercased to avoid casing differences.
normalize_headers() {
  local input_file="$1"

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
  ' "${input_file}" | sort
}

# Normalize backend-specific base URLs in bodies so only semantic differences remain.
normalize_body() {
  local input_file="$1"

  sed \
    -e 's#http://127\.0\.0\.1:3001#<BASE_URL>#g' \
    -e 's#http://127\.0\.0\.1:8082#<BASE_URL>#g' \
    "${input_file}"
}

# Compare one logical test case between Express and FastAPI.
#
# A case fails if at least one of these differs:
# - numeric HTTP status code
# - normalized headers
# - normalized body
#
# The script records the failed case but continues running the remaining cases.
compare_case() {
  local name="$1"
  local method="$2"
  local path_template="$3"
  local body="${4:-}"

  local case_failed=0

  local safe_name
  safe_name="$(sanitize_name "${name}")"

  local express_prefix="${TMP_DIR}/${safe_name}_express"
  local fastapi_prefix="${TMP_DIR}/${safe_name}_fastapi"

  local express_path
  local fastapi_path

  express_path="$(resolve_path_for_backend express "${path_template}")"
  fastapi_path="$(resolve_path_for_backend fastapi "${path_template}")"

  print_section "${name}"

  perform_request "${name} - Express" "${method}" "${EXPRESS_BASE_URL}${express_path}" "${body}" "${express_prefix}"
  perform_request "${name} - FastAPI" "${method}" "${FASTAPI_BASE_URL}${fastapi_path}" "${body}" "${fastapi_prefix}"

  local express_status_code
  local fastapi_status_code

  express_status_code="$(extract_status_code "${express_prefix}.headers")"
  fastapi_status_code="$(extract_status_code "${fastapi_prefix}.headers")"

  local express_headers_norm="${express_prefix}.headers.norm"
  local fastapi_headers_norm="${fastapi_prefix}.headers.norm"
  local express_body_norm="${express_prefix}.body.norm"
  local fastapi_body_norm="${fastapi_prefix}.body.norm"

  normalize_headers "${express_prefix}.headers" > "${express_headers_norm}"
  normalize_headers "${fastapi_prefix}.headers" > "${fastapi_headers_norm}"

  normalize_body "${express_prefix}.body" > "${express_body_norm}"
  normalize_body "${fastapi_prefix}.body" > "${fastapi_body_norm}"

  echo "-- Comparison --"

  if [[ "${express_status_code}" == "${fastapi_status_code}" ]]; then
    echo "Status: MATCH (${express_status_code})"
  else
    echo "Status: DIFFERENT"
    echo "  Express: ${express_status_code}"
    echo "  FastAPI: ${fastapi_status_code}"
    case_failed=1
  fi

  if diff -u "${express_headers_norm}" "${fastapi_headers_norm}" > /dev/null; then
    echo "Headers: MATCH"
  else
    echo "Headers: DIFFERENT"
    diff -u "${express_headers_norm}" "${fastapi_headers_norm}" || true
    case_failed=1
  fi

  if diff -u "${express_body_norm}" "${fastapi_body_norm}" > /dev/null; then
    echo "Body: MATCH"
  else
    echo "Body: DIFFERENT"
    diff -u "${express_body_norm}" "${fastapi_body_norm}" || true
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
# This avoids failing immediately when Docker reports the container as started,
# but the application inside the container is not ready yet.
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

# Check that both backends are reachable before running the tests.
check_backend_ready() {
  print_section "Checking backend availability"

  if ! check_url_ready "Express backend" "${EXPRESS_BASE_URL}"; then
    echo "Start it first, for example with:"
    echo "  docker compose up -d postgres express fastapi"
    exit 1
  fi

  if ! check_url_ready "FastAPI backend" "${FASTAPI_BASE_URL}"; then
    echo "Start it first, for example with:"
    echo "  docker compose up -d postgres express fastapi"
    exit 1
  fi

  echo "Both backends are reachable."
}

# Reset both databases and seed the same deterministic starting rows.
seed_test_data() {
  print_section "Preparing clean test state"

  # Reset both backend databases to a clean state and restart identity.
  ./scripts/express/reset-express-db.sh
  ./scripts/fastapi/reset-fastapi-db.sh

  local express_seed_1_json
  local express_seed_2_json
  local fastapi_seed_1_json
  local fastapi_seed_2_json

  express_seed_1_json="$(
    curl -sS -X POST "${EXPRESS_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-one","completed":false,"order":1}'
  )"

  express_seed_2_json="$(
    curl -sS -X POST "${EXPRESS_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-two","completed":true,"order":2}'
  )"

  fastapi_seed_1_json="$(
    curl -sS -X POST "${FASTAPI_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-one","completed":false,"order":1}'
  )"

  fastapi_seed_2_json="$(
    curl -sS -X POST "${FASTAPI_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-two","completed":true,"order":2}'
  )"

  EXPRESS_SEED_ID_1="$(extract_json_id "${express_seed_1_json}")"
  EXPRESS_SEED_ID_2="$(extract_json_id "${express_seed_2_json}")"
  FASTAPI_SEED_ID_1="$(extract_json_id "${fastapi_seed_1_json}")"
  FASTAPI_SEED_ID_2="$(extract_json_id "${fastapi_seed_2_json}")"

  if [[ -z "${EXPRESS_SEED_ID_1}" || -z "${EXPRESS_SEED_ID_2}" || -z "${FASTAPI_SEED_ID_1}" || -z "${FASTAPI_SEED_ID_2}" ]]; then
    echo "Failed to capture seeded IDs."
    exit 1
  fi

  echo "Express seeded IDs: ${EXPRESS_SEED_ID_1}, ${EXPRESS_SEED_ID_2}"
  echo "FastAPI seeded IDs: ${FASTAPI_SEED_ID_1}, ${FASTAPI_SEED_ID_2}"
}

main() {
  print_section "Parity comparison"
  echo "Express base URL: ${EXPRESS_BASE_URL}"
  echo "FastAPI base URL: ${FASTAPI_BASE_URL}"

  check_backend_ready
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

  # This is the important final step.
  # Without this call, mismatches would be printed but the script would still exit successfully.
  print_parity_summary_and_exit
}

main "$@"