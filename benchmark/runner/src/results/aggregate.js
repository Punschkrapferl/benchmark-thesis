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

// Aggregate all measured repetition metrics into one representative result set.
// Each metric is aggregated independently using median.
function aggregateMeasuredMetrics(measuredMetricsList) {
  return {
    throughput: median(measuredMetricsList.map((item) => item.throughput)),
    latency_median: median(measuredMetricsList.map((item) => item.latency_median)),
    latency_p90: median(measuredMetricsList.map((item) => item.latency_p90)),
    latency_p99: median(measuredMetricsList.map((item) => item.latency_p99)),
    error_rate: median(measuredMetricsList.map((item) => item.error_rate))
  };
}

module.exports = {
  aggregateMeasuredMetrics
};