function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

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

  const failureCount = errors + timeouts + non2xx;

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