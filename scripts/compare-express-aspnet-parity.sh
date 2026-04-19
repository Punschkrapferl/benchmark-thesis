#!/usr/bin/env bash

# Exit immediately on:
# - any command failure
# - use of an undefined variable
# - failure inside a pipeline
set -euo pipefail

# Optional custom base URLs.
# If not provided, use the local default ports for Express and ASP.NET.
EXPRESS_BASE_URL="${1:-http://127.0.0.1:3001}"
ASPNET_BASE_URL="${2:-http://127.0.0.1:8081}"

# Temporary directory for intermediate response files.
# It is removed automatically when the script exits.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# These variables will store the real seeded IDs returned by each backend.
EXPRESS_SEED_ID_1=""
EXPRESS_SEED_ID_2=""
ASPNET_SEED_ID_1=""
ASPNET_SEED_ID_2=""

# Print a visual section title.
print_section() {
  local title="$1"
  echo
  echo "=================================================="
  echo "${title}"
  echo "=================================================="
}

# Convert a human-readable test name into a safe filename fragment.
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

# Replace placeholder tokens in paths with the real seeded IDs.
# This allows the same logical test case to target matching seeded resources
# even if IDs differ between backends.
resolve_path_for_backend() {
  local backend="$1"
  local path_template="$2"

  local resolved="${path_template}"

  if [[ "${backend}" == "express" ]]; then
    resolved="${resolved//\{\{seed_1\}\}/${EXPRESS_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${EXPRESS_SEED_ID_2}}"
  else
    resolved="${resolved//\{\{seed_1\}\}/${ASPNET_SEED_ID_1}}"
    resolved="${resolved//\{\{seed_2\}\}/${ASPNET_SEED_ID_2}}"
  fi

  printf '%s' "${resolved}"
}

# Extract the numeric "id" field from a simple JSON object response.
# This is sufficient for the todo create responses used by this script.
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
# - the full raw response
# - the headers only
# - the body only
#
# Parameters:
# 1 = label shown in terminal output
# 2 = HTTP method
# 3 = full URL
# 4 = optional request body
# 5 = output file prefix
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
# Important:
# - skip the first line (status line), because status is compared separately
# - remove unstable or transport-specific headers
# - normalize JSON content-type variants
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

# Normalize bodies before comparison.
# Replace backend-specific base URLs so that only semantic differences remain.
normalize_body() {
  local input_file="$1"

  sed \
    -e 's#http://127\.0\.0\.1:3001#<BASE_URL>#g' \
    -e 's#http://127\.0\.0\.1:8081#<BASE_URL>#g' \
    "${input_file}"
}

# Compare one test case between Express and ASP.NET.
#
# Parameters:
# 1 = human-readable test name
# 2 = HTTP method
# 3 = request path template, may contain {{seed_1}} or {{seed_2}}
# 4 = optional request body
compare_case() {
  local name="$1"
  local method="$2"
  local path_template="$3"
  local body="${4:-}"

  local safe_name
  safe_name="$(sanitize_name "${name}")"

  local express_prefix="${TMP_DIR}/${safe_name}_express"
  local aspnet_prefix="${TMP_DIR}/${safe_name}_aspnet"

  local express_path
  local aspnet_path
  express_path="$(resolve_path_for_backend express "${path_template}")"
  aspnet_path="$(resolve_path_for_backend aspnet "${path_template}")"

  print_section "${name}"

  perform_request "${name} - Express" "${method}" "${EXPRESS_BASE_URL}${express_path}" "${body}" "${express_prefix}"
  perform_request "${name} - ASP.NET" "${method}" "${ASPNET_BASE_URL}${aspnet_path}" "${body}" "${aspnet_prefix}"

  local express_status_code
  local aspnet_status_code
  express_status_code="$(extract_status_code "${express_prefix}.headers")"
  aspnet_status_code="$(extract_status_code "${aspnet_prefix}.headers")"

  local express_headers_norm="${express_prefix}.headers.norm"
  local aspnet_headers_norm="${aspnet_prefix}.headers.norm"
  local express_body_norm="${express_prefix}.body.norm"
  local aspnet_body_norm="${aspnet_prefix}.body.norm"

  normalize_headers "${express_prefix}.headers" > "${express_headers_norm}"
  normalize_headers "${aspnet_prefix}.headers" > "${aspnet_headers_norm}"

  normalize_body "${express_prefix}.body" > "${express_body_norm}"
  normalize_body "${aspnet_prefix}.body" > "${aspnet_body_norm}"

  echo "-- Comparison --"

  if [[ "${express_status_code}" == "${aspnet_status_code}" ]]; then
    echo "Status: MATCH (${express_status_code})"
  else
    echo "Status: DIFFERENT"
    echo "  Express: ${express_status_code}"
    echo "  ASP.NET: ${aspnet_status_code}"
  fi

  if diff -u "${express_headers_norm}" "${aspnet_headers_norm}" > /dev/null; then
    echo "Headers: MATCH"
  else
    echo "Headers: DIFFERENT"
    diff -u "${express_headers_norm}" "${aspnet_headers_norm}" || true
  fi

  if diff -u "${express_body_norm}" "${aspnet_body_norm}" > /dev/null; then
    echo "Body: MATCH"
  else
    echo "Body: DIFFERENT"
    diff -u "${express_body_norm}" "${aspnet_body_norm}" || true
  fi
}

# Check that both target backends are reachable before running tests.
check_backend_ready() {
  print_section "Checking backend availability"

  if ! curl -fsS "${EXPRESS_BASE_URL}/todos" > /dev/null; then
    echo "Express backend is not reachable at ${EXPRESS_BASE_URL}"
    echo "Start it first, for example with:"
    echo "  docker compose up -d postgres express aspnet"
    exit 1
  fi

  if ! curl -fsS "${ASPNET_BASE_URL}/todos" > /dev/null; then
    echo "ASP.NET backend is not reachable at ${ASPNET_BASE_URL}"
    echo "Start it first, for example with:"
    echo "  docker compose up -d postgres express aspnet"
    exit 1
  fi

  echo "Both backends are reachable."
}

# Reset both backends and seed the same initial data.
# The returned IDs are captured and reused in later test cases.
seed_test_data() {
  print_section "Preparing clean test state"

  # Reset both backend databases to a clean state and restart identity.
  # This ensures both backends start parity testing from the same DB state.
  ./scripts/express/reset-express-db.sh
  ./scripts/aspnet/reset-aspnet-db.sh

  local express_seed_1_json
  local express_seed_2_json
  local aspnet_seed_1_json
  local aspnet_seed_2_json

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

  aspnet_seed_1_json="$(
    curl -sS -X POST "${ASPNET_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-one","completed":false,"order":1}'
  )"

  aspnet_seed_2_json="$(
    curl -sS -X POST "${ASPNET_BASE_URL}/todos" \
      -H "Content-Type: application/json" \
      -d '{"title":"seed-two","completed":true,"order":2}'
  )"

  EXPRESS_SEED_ID_1="$(extract_json_id "${express_seed_1_json}")"
  EXPRESS_SEED_ID_2="$(extract_json_id "${express_seed_2_json}")"
  ASPNET_SEED_ID_1="$(extract_json_id "${aspnet_seed_1_json}")"
  ASPNET_SEED_ID_2="$(extract_json_id "${aspnet_seed_2_json}")"

  if [[ -z "${EXPRESS_SEED_ID_1}" || -z "${EXPRESS_SEED_ID_2}" || -z "${ASPNET_SEED_ID_1}" || -z "${ASPNET_SEED_ID_2}" ]]; then
    echo "Failed to capture seeded IDs."
    exit 1
  fi

  echo "Express seeded IDs: ${EXPRESS_SEED_ID_1}, ${EXPRESS_SEED_ID_2}"
  echo "ASP.NET seeded IDs: ${ASPNET_SEED_ID_1}, ${ASPNET_SEED_ID_2}"
}

main() {
  print_section "Parity comparison"
  echo "Express base URL: ${EXPRESS_BASE_URL}"
  echo "ASP.NET base URL: ${ASPNET_BASE_URL}"

  check_backend_ready
  seed_test_data

  compare_case "GET /todos" "GET" "/todos"
  compare_case "GET existing todo" "GET" "/todos/{{seed_1}}"
  compare_case "GET /todos/abc" "GET" "/todos/abc"
  compare_case "GET unknown route" "GET" "/does-not-exist"

  compare_case "POST valid todo" "POST" "/todos" '{"title":"hello","completed":false,"order":5}'
  compare_case "POST invalid completed null" "POST" "/todos" '{"title":"test","completed":null}'
  compare_case "POST malformed JSON" "POST" "/todos" '{"title":'

  compare_case "PATCH existing todo order null" "PATCH" "/todos/{{seed_1}}" '{"order":null}'
  compare_case "PATCH invalid field on existing todo" "PATCH" "/todos/{{seed_1}}" '{"unknown":123}'
  compare_case "PATCH invalid id" "PATCH" "/todos/abc" '{"title":"x"}'

  compare_case "DELETE existing todo" "DELETE" "/todos/{{seed_2}}"
  compare_case "DELETE unknown id" "DELETE" "/todos/999999"
  compare_case "DELETE invalid id" "DELETE" "/todos/abc"

  compare_case "DELETE /todos" "DELETE" "/todos"
  compare_case "GET /todos after delete all" "GET" "/todos"
}

main "$@"