const { runRepetitions } = require("./repetition-runner");
const { extractMetricsFromAutocannonResult } = require("../results/metrics");
const { aggregateMeasuredMetrics } = require("../results/aggregate");

// Convert two timestamps in milliseconds into a rounded wall-clock duration in seconds.
// This is useful for documenting how long one full experiment point took overall.
function toWallClockDurationSeconds(startedAtMs, finishedAtMs) {
  return Number(((finishedAtMs - startedAtMs) / 1000).toFixed(3));
}

// Run one complete experiment point.
// An experiment point is one concrete combination such as:
// - backend = express
// - scenario = s1-read-only
// - state = medium
// - concurrency = 8
//
// This function:
// 1. runs warmup + measured repetitions
// 2. extracts benchmark metrics from the measured runs
// 3. aggregates measured metrics using the configured strategy (median)
// 4. returns a full structured result object
async function runExperiment({ target, experimentPoint }) {
  const experimentStartedAtMs = Date.now();
  const experimentStartedAt = new Date(experimentStartedAtMs).toISOString();

  // Run all warmup and measured repetitions for this experiment point.
  const { warmupResults, measuredResults } = await runRepetitions({
    target,
    experimentPoint
  });

  // Convert raw autocannon output from each measured repetition
  // into the benchmark metrics we care about.
  const measuredMetrics = measuredResults.map((result, index) => ({
    repetition: index + 1,
    ...extractMetricsFromAutocannonResult(result.raw)
  }));

  // Aggregate the measured metrics across all measured repetitions.
  // In this benchmark methodology, median is used to reduce noise.
  const aggregatedMetrics = aggregateMeasuredMetrics(measuredMetrics);

  const experimentFinishedAtMs = Date.now();
  const experimentFinishedAt = new Date(experimentFinishedAtMs).toISOString();

  // Return one structured result object for later writing into JSON/CSV files.
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