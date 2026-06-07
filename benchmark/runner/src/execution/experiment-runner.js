const { runRepetitions } = require("./repetition-runner");
const { extractMetricsFromK6Summary } = require("../results/metrics");
const { aggregateMeasuredMetrics } = require("../results/aggregate");

// Convert two timestamps in milliseconds into a rounded wall-clock duration in seconds.
function toWallClockDurationSeconds(startedAtMs, finishedAtMs) {
  return Number(((finishedAtMs - startedAtMs) / 1000).toFixed(3));
}

// Run one complete experiment point.
async function runExperiment({ target, experimentPoint }) {
  const experimentStartedAtMs = Date.now();
  const experimentStartedAt = new Date(experimentStartedAtMs).toISOString();

  const { warmupResults, measuredResults } = await runRepetitions({
    target,
    experimentPoint
  });

  const measuredMetrics = measuredResults.map((result, index) => ({
    repetition: index + 1,
    ...extractMetricsFromK6Summary(result.raw)
  }));

  const aggregatedMetrics = aggregateMeasuredMetrics(measuredMetrics);

  const experimentFinishedAtMs = Date.now();
  const experimentFinishedAt = new Date(experimentFinishedAtMs).toISOString();

  return {
    backend: experimentPoint.backend,
    scenarioId: experimentPoint.scenarioId,
    scenarioName: experimentPoint.scenarioName,
    stateName: experimentPoint.stateName,
    loadModel: experimentPoint.loadModel,
    loadLevel: experimentPoint.loadLevel,
    maxVus: experimentPoint.maxVus,
    requestTimeoutSeconds: experimentPoint.requestTimeoutSeconds,
    warmupRuns: experimentPoint.warmupRuns,
    measuredRuns: experimentPoint.measuredRuns,
    warmupDurationSeconds: experimentPoint.warmupDurationSeconds,
    measuredDurationSeconds: experimentPoint.measuredDurationSeconds,
    executionMetadata: {
      startedAt: experimentStartedAt,
      finishedAt: experimentFinishedAt,
      wallClockDurationSeconds: toWallClockDurationSeconds(
        experimentStartedAtMs,
        experimentFinishedAtMs
      )
    },
    warmupResults,
    measuredResults,
    measuredMetrics,
    aggregatedMetrics
  };
}

module.exports = {
  runExperiment
};
