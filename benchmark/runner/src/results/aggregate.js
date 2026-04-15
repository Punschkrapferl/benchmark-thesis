function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

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