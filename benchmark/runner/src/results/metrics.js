// Return the number if it is a valid finite numeric value;
// otherwise return 0 as a safe fallback.
function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// k6 v0.x nests stats under metric.values; k6 v2+ flattens them on the metric object.
function readMetricStat(metric, statName) {
  if (!metric || typeof metric !== "object") {
    return 0;
  }

  if (typeof metric[statName] === "number") {
    return safeNumber(metric[statName]);
  }

  if (metric.values && typeof metric.values[statName] === "number") {
    return safeNumber(metric.values[statName]);
  }

  return 0;
}

function extractErrorRate(httpReqFailedMetric) {
  if (!httpReqFailedMetric || typeof httpReqFailedMetric !== "object") {
    return 0;
  }

  const rateFromValues = httpReqFailedMetric.values?.rate;
  if (typeof rateFromValues === "number" && Number.isFinite(rateFromValues)) {
    return rateFromValues;
  }

  if (typeof httpReqFailedMetric.rate === "number" && Number.isFinite(httpReqFailedMetric.rate)) {
    return httpReqFailedMetric.rate;
  }

  if (typeof httpReqFailedMetric.value === "number" && Number.isFinite(httpReqFailedMetric.value)) {
    return httpReqFailedMetric.value;
  }

  const passes = safeNumber(httpReqFailedMetric.passes);
  const fails = safeNumber(httpReqFailedMetric.fails);
  const total = passes + fails;

  if (total > 0) {
    return fails / total;
  }

  return 0;
}

// Extract benchmark metrics from k6 --summary-export JSON.
function extractMetricsFromK6Summary(summary) {
  const metrics = summary.metrics;

  if (!metrics || typeof metrics !== "object") {
    throw new Error("k6 summary export is missing a metrics object");
  }

  const httpReqDuration = metrics.http_req_duration;
  const httpReqs = metrics.http_reqs;
  const httpReqFailed = metrics.http_req_failed;

  // Only emitted by arrival-rate (open-model) executors. It counts iterations
  // k6 could not start because every allocated VU was still busy, i.e. the
  // load generator could not deliver the offered request rate. Absent (0) for
  // closed-model runs.
  const droppedIterations = metrics.dropped_iterations;

  return {
    throughput: readMetricStat(httpReqs, "rate"),
    latency_median: readMetricStat(httpReqDuration, "med"),
    latency_p90: readMetricStat(httpReqDuration, "p(90)"),
    latency_p99: readMetricStat(httpReqDuration, "p(99)"),
    error_rate: extractErrorRate(httpReqFailed),
    dropped_iteration_rate: readMetricStat(droppedIterations, "rate")
  };
}

module.exports = {
  extractMetricsFromK6Summary
};
