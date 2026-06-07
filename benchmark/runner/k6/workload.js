import http from "k6/http";

// Benchmark workload executed by k6.
// Scenario operations and data-state metadata are passed from the Node runner via env.

const baseUrl = __ENV.BENCH_BASE_URL;
const duration = __ENV.BENCH_DURATION;
const loadModel = __ENV.BENCH_LOAD_MODEL;
const requestTimeout = __ENV.BENCH_REQUEST_TIMEOUT;

// Build the k6 executor for this experiment point.
//
// closed: constant-vus holds a fixed number of connected clients. Each client
//   sends the next request only after the previous response, so the offered load
//   is self-throttling and the backend can never be overloaded (plateau study).
//
// open: constant-arrival-rate injects a fixed request rate (req/s) regardless of
//   whether the backend keeps up. When the backend saturates, latency climbs,
//   requests time out (error_rate) and k6 runs out of VUs (dropped iterations),
//   which is what reveals the breaking point (overload study).
function buildBenchmarkScenario() {
  if (loadModel === "open") {
    const rate = Number.parseInt(__ENV.BENCH_RATE, 10);
    const maxVus = Number.parseInt(__ENV.BENCH_MAX_VUS, 10);

    return {
      executor: "constant-arrival-rate",
      rate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs: maxVus,
      maxVus
    };
  }

  if (loadModel === "closed") {
    return {
      executor: "constant-vus",
      vus: Number.parseInt(__ENV.BENCH_VUS, 10),
      duration
    };
  }

  throw new Error(`Unknown BENCH_LOAD_MODEL: "${loadModel}". Expected "closed" or "open".`);
}

export const options = {
  scenarios: {
    benchmark: buildBenchmarkScenario()
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  thresholds: {}
};

function expandOperations(operations) {
  const expanded = [];

  for (const operation of operations) {
    for (let index = 0; index < operation.weight; index += 1) {
      expanded.push(operation);
    }
  }

  if (expanded.length !== 100) {
    throw new Error(
      `Operation weights must expand to exactly 100 entries, got ${expanded.length}`
    );
  }

  return expanded;
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createTitle(vu, iteration) {
  return `benchmark-todo-${vu}-${iteration}`;
}

function createCompletedValue(vu, iteration) {
  return (vu + iteration) % 2 === 0;
}

function resolveRandomTodoId(state) {
  if (
    state.rowCount === 0 ||
    state.idMin === null ||
    state.idMax === null
  ) {
    throw new Error(
      `Cannot resolve ":id" because state "${state.name}" has no valid id range`
    );
  }

  return randomIntInclusive(state.idMin, state.idMax);
}

// Resolve a random keyset cursor for paginated reads.
//
// The backends paginate with WHERE id > afterId ORDER BY id ASC LIMIT limit.
// A random afterId in [0, idMax - limit] makes every page request land on a
// real, full page while keeping the query cost O(log n) regardless of depth.
function resolveAfterId(state, limit) {
  if (!state.idMax || state.idMax <= 0) {
    return 0;
  }

  const safeLimit = Math.max(1, limit);
  const maxAfterId = Math.max(0, state.idMax - safeLimit);

  return randomIntInclusive(0, maxAfterId);
}

function extractLimitFromPath(pathTemplate) {
  const match = pathTemplate.match(/[?&]limit=(\d+)/);

  if (!match) {
    return 100;
  }

  const parsedLimit = Number.parseInt(match[1], 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return 100;
  }

  return parsedLimit;
}

function resolvePath(pathTemplate, state) {
  let resolvedPath = pathTemplate;

  if (resolvedPath.includes(":id")) {
    const id = resolveRandomTodoId(state);
    resolvedPath = resolvedPath.replace(":id", String(id));
  }

  if (resolvedPath.includes("{{afterId}}")) {
    const limit = extractLimitFromPath(resolvedPath);
    const afterId = resolveAfterId(state, limit);
    resolvedPath = resolvedPath.replace("{{afterId}}", String(afterId));
  }

  return resolvedPath;
}

function buildBodyFromTemplate(bodyTemplate, vu, iteration) {
  if (!bodyTemplate) {
    return null;
  }

  const result = {};

  for (const [key, value] of Object.entries(bodyTemplate)) {
    if (value === "{{title}}") {
      result[key] = createTitle(vu, iteration);
      continue;
    }

    if (value === "{{order}}") {
      result[key] = iteration;
      continue;
    }

    if (value === "{{completed}}") {
      result[key] = createCompletedValue(vu, iteration);
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function setup() {
  const operations = JSON.parse(__ENV.BENCH_OPERATIONS);
  const state = JSON.parse(__ENV.BENCH_STATE);

  return {
    expandedOperations: expandOperations(operations),
    state
  };
}

export default function runWorkload(data) {
  const operation =
    data.expandedOperations[Math.floor(Math.random() * data.expandedOperations.length)];

  const path = resolvePath(operation.path, data.state);
  const url = `${baseUrl}${path}`;
  const bodyObject = buildBodyFromTemplate(operation.bodyTemplate, __VU, __ITER);

  const params = {
    headers: {
      "Content-Type": "application/json"
    },
    tags: {
      operation: operation.name
    },
    timeout: requestTimeout
  };

  if (bodyObject !== null) {
    http.request(operation.method, url, JSON.stringify(bodyObject), params);
    return;
  }

  http.request(operation.method, url, null, params);
}
