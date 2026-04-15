const { runRepetitions } = require("./repetition-runner");
const { extractMetricsFromAutocannonResult } = require("../results/metrics");
const { aggregateMeasuredMetrics } = require("../results/aggregate");

function toWallClockDurationSeconds(startedAtMs, finishedAtMs) {
  return Number(((finishedAtMs - startedAtMs) / 1000).toFixed(3));
}

async function runExperiment({ target, experimentPoint }) {
  const experimentStartedAtMs = Date.now();
  const experimentStartedAt = new Date(experimentStartedAtMs).toISOString();

  const { warmupResults, measuredResults } = await runRepetitions({
    target,
    experimentPoint
  });

  const measuredMetrics = measuredResults.map((result, index) => ({
    repetition: index + 1,
    ...extractMetricsFromAutocannonResult(result.raw)
  }));

  const aggregatedMetrics = aggregateMeasuredMetrics(measuredMetrics);

  const experimentFinishedAtMs = Date.now();
  const experimentFinishedAt = new Date(experimentFinishedAtMs).toISOString();

  return {
    backend: experimentPoint.backend,
    scenarioId: experimentPoint.scenarioId,
    scenarioName: experimentPoint.scenarioName,
    stateName: experimentPoint.stateName,
    concurrency: experimentPoint.concurrency,
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