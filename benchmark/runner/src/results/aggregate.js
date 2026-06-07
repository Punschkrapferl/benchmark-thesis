// Compute the median of a numeric array.
// Median is used as the aggregation strategy because it is more robust
// against outliers than a simple arithmetic mean.
function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);

  // For even-length arrays, return the average of the two middle values.
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  // For odd-length arrays, return the middle value directly.
  return sorted[middleIndex];
}

// Compute the maximum of a numeric array.
function maximum(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  return values.reduce((highest, value) => (value > highest ? value : highest), values[0]);
}

// Aggregate all measured repetition metrics into one representative result set.
//
// Performance metrics (throughput, latency) use the median because it is robust
// against outliers. Failure metrics (error_rate, dropped_iteration_rate) use the
// maximum on purpose: a single repetition where the backend failed or the load
// generator shed load is exactly the breaking-point signal we are looking for,
// and the median would discard it.
function aggregateMeasuredMetrics(measuredMetricsList) {
  return {
    throughput: median(measuredMetricsList.map((item) => item.throughput)),
    latency_median: median(measuredMetricsList.map((item) => item.latency_median)),
    latency_p90: median(measuredMetricsList.map((item) => item.latency_p90)),
    latency_p99: median(measuredMetricsList.map((item) => item.latency_p99)),
    error_rate: maximum(measuredMetricsList.map((item) => item.error_rate)),
    dropped_iteration_rate: maximum(
      measuredMetricsList.map((item) => item.dropped_iteration_rate)
    )
  };
}

module.exports = {
  aggregateMeasuredMetrics
};