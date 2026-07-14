#!/usr/bin/env bash

# Benchmark fairness preflight.
#
# Verifies that the runtime setup matches the fairness contract
# documented in docs/benchmark-fairness.md, so cross-backend comparisons are
# valid. This is operational verification (CPU limits, worker counts, pool
# sizes, network, load generator) and is intentionally separate from the HTTP
# parity scripts, which only verify API behavior.
#
# Usage:
#   scripts/verify-benchmark-fairness.sh [backend|all]
#
# Exit code:
# - 0 means every hard check passed
# - 1 means at least one check failed

set -euo pipefail

# Fairness contract (keep in sync with docker-compose.yml and docs/benchmark-fairness.md).
readonly EXPECTED_BACKEND_NANO_CPUS=4000000000
readonly EXPECTED_POSTGRES_NANO_CPUS=2000000000
readonly EXPECTED_TOTAL_POOL=20
readonly K6_DOCKER_IMAGE="${K6_DOCKER_IMAGE:-grafana/k6:2.0.0}"
readonly DOCKER_NETWORK="${BENCHMARK_DOCKER_NETWORK:-benchmark-net}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

FAILED_CHECKS=0

pass() { echo "  PASS  $1"; }
fail() {
  echo "  FAIL  $1"
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
}
info() { echo "  INFO  $1"; }

section() {
  echo
  echo "=================================================="
  echo "$1"
  echo "=================================================="
}

# Assert a container's NanoCpus limit equals the expected value.
check_cpus() {
  local container="$1"
  local expected="$2"
  local actual

  actual="$(docker inspect --format '{{.HostConfig.NanoCpus}}' "${container}" 2>/dev/null || true)"

  if [[ -z "${actual}" ]]; then
    fail "${container}: not running or not found"
    return
  fi

  if [[ "${actual}" == "${expected}" ]]; then
    pass "${container}: cpus limit = $((expected / 1000000000)) cores"
  else
    fail "${container}: cpus = ${actual} ns (expected ${expected})"
  fi
}

# Count processes inside a container whose command matches a pattern.
count_procs() {
  local container="$1"
  local pattern="$2"

  docker top "${container}" -o pid,comm 2>/dev/null | tail -n +2 | grep -c "${pattern}" || true
}

# Assert an environment variable on a container equals the expected value.
check_env() {
  local container="$1"
  local key="$2"
  local expected="$3"
  local actual

  actual="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${container}" 2>/dev/null \
    | grep "^${key}=" | head -1 | cut -d= -f2- || true)"

  if [[ "${actual}" == "${expected}" ]]; then
    pass "${container}: ${key}=${expected}"
  else
    fail "${container}: ${key}=${actual:-<unset>} (expected ${expected})"
  fi
}

# Verify the per-backend worker/process model and total DB pool size.
check_backend() {
  local backend="$1"

  local container port proc_name min_procs

  case "${backend}" in
    express)
      container="benchmark-express"; port=3001; proc_name="node"; min_procs=5
      ;;
    springboot)
      container="benchmark-springboot"; port=8080; proc_name="java"; min_procs=1
      ;;
    aspnet)
      container="benchmark-aspnet"; port=8081; proc_name="dotnet"; min_procs=1
      ;;
    fastapi)
      container="benchmark-fastapi"; port=8082; proc_name="python"; min_procs=5
      ;;
    *)
      echo "Unknown backend: ${backend}"
      exit 1
      ;;
  esac

  section "Backend: ${backend} (${container}, port ${port})"

  if ! docker inspect "${container}" > /dev/null 2>&1; then
    fail "${container}: not running"
    return
  fi

  check_cpus "${container}" "${EXPECTED_BACKEND_NANO_CPUS}"

  local proc_count
  proc_count="$(count_procs "${container}" "${proc_name}")"
  if [[ "${proc_count}" -ge "${min_procs}" ]]; then
    pass "${container}: ${proc_count} ${proc_name} process(es) (expected >= ${min_procs})"
  else
    fail "${container}: ${proc_count} ${proc_name} process(es) (expected >= ${min_procs})"
  fi

  # Network membership.
  if docker network inspect "${DOCKER_NETWORK}" --format '{{range .Containers}}{{println .Name}}{{end}}' 2>/dev/null \
    | grep -qx "${container}"; then
    pass "${container}: attached to ${DOCKER_NETWORK}"
  else
    fail "${container}: not attached to ${DOCKER_NETWORK}"
  fi

  # Per-backend connection pool checks (total must be ${EXPECTED_TOTAL_POOL}).
  case "${backend}" in
    express)
      check_env "${container}" "WEB_CONCURRENCY" "4"
      check_env "${container}" "DB_POOL_MAX" "5"
      info "Total pool = 4 workers x 5 = ${EXPECTED_TOTAL_POOL}"
      ;;
    fastapi)
      check_env "${container}" "DB_POOL_MAX_SIZE" "5"
      info "Total pool = 4 workers x 5 = ${EXPECTED_TOTAL_POOL}"
      ;;
    aspnet)
      if docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${container}" 2>/dev/null \
        | grep -qi "Maximum Pool Size=${EXPECTED_TOTAL_POOL}"; then
        pass "${container}: Maximum Pool Size=${EXPECTED_TOTAL_POOL}"
      else
        fail "${container}: Maximum Pool Size != ${EXPECTED_TOTAL_POOL}"
      fi
      ;;
    springboot)
      # Hikari pool is baked into application.properties (not a runtime env var),
      # so this is a static source check.
      local props="backends/springboot/src/main/resources/application.properties"
      if grep -qx "spring.datasource.hikari.maximum-pool-size=${EXPECTED_TOTAL_POOL}" "${props}"; then
        pass "${container}: Hikari maximum-pool-size=${EXPECTED_TOTAL_POOL} (in ${props})"
      else
        fail "${container}: Hikari maximum-pool-size != ${EXPECTED_TOTAL_POOL} (check ${props})"
      fi
      ;;
  esac
}

# Checks that are independent of which backend is under test.
check_shared() {
  section "Shared infrastructure"

  check_cpus "benchmark-postgres" "${EXPECTED_POSTGRES_NANO_CPUS}"

  if docker image inspect "${K6_DOCKER_IMAGE}" > /dev/null 2>&1; then
    pass "k6 load generator image present: ${K6_DOCKER_IMAGE}"
  else
    fail "k6 image missing: ${K6_DOCKER_IMAGE} (runner will pull on first use)"
  fi

  if docker network inspect "${DOCKER_NETWORK}" > /dev/null 2>&1; then
    pass "Docker network exists: ${DOCKER_NETWORK}"
  else
    fail "Docker network missing: ${DOCKER_NETWORK}"
  fi
}

main() {
  local target="${1:-all}"

  echo "Benchmark fairness preflight"
  echo "Contract: backend=$((EXPECTED_BACKEND_NANO_CPUS / 1000000000)) cores, postgres=$((EXPECTED_POSTGRES_NANO_CPUS / 1000000000)) cores, total DB pool=${EXPECTED_TOTAL_POOL}"

  check_shared

  if [[ "${target}" == "all" ]]; then
    for backend in express springboot aspnet fastapi; do
      check_backend "${backend}"
    done
  else
    check_backend "${target}"
  fi

  section "Result"
  if [[ "${FAILED_CHECKS}" -eq 0 ]]; then
    echo "All fairness checks passed."
    exit 0
  fi

  echo "Fairness check failed: ${FAILED_CHECKS} problem(s)."
  exit 1
}

main "$@"
