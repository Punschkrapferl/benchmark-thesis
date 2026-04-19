// Return the number if it is a valid finite numeric value;
// otherwise return 0 as a safe fallback.
function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Extract the benchmark metrics we care about from raw autocannon output.
//
// The selected metrics are:
// - throughput
// - latency median (p50)
// - latency p90
// - latency p99
// - error rate
function extractMetricsFromAutocannonResult(rawResult) {
  const throughput = safeNumber(rawResult.requests?.average);
  const latencyMedian = safeNumber(rawResult.latency?.p50);
  const latencyP90 = safeNumber(rawResult.latency?.p90);
  const latencyP99 = safeNumber(rawResult.latency?.p99);

  const errors = safeNumber(rawResult.errors);
  const timeouts = safeNumber(rawResult.timeouts);
  const non2xx = safeNumber(rawResult.non2xx);

  const completedRequests = safeNumber(rawResult.requests?.total);
  const sentRequests = safeNumber(rawResult.requests?.sent);

  // Count all request failures together.
  const failureCount = errors + timeouts + non2xx;

  // Use the best available denominator when computing the error rate.
  // Prefer completed requests, then sent requests, then failure count if necessary.
  const denominator =
    completedRequests > 0
      ? completedRequests
      : sentRequests > 0
        ? sentRequests
        : failureCount > 0
          ? failureCount
          : 0;

  const errorRate = denominator > 0 ? failureCount / denominator : 0;

  return {
    throughput,
    latency_median: latencyMedian,
    latency_p90: latencyP90,
    latency_p99: latencyP99,
    error_rate: errorRate
  };
}

module.exports = {
  extractMetricsFromAutocannonResult
};