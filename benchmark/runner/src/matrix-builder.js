// Expand the experiment matrix into a flat list of concrete experiment points.
//
// Example:
// If a matrix entry contains:
// - scenario = s1-read-only
// - states = [small, medium]
// - concurrency = [1, 8]
//
// then this function creates four concrete experiment points:
// - s1-read-only + small + 1
// - s1-read-only + small + 8
// - s1-read-only + medium + 1
// - s1-read-only + medium + 8
function buildExperimentPoints({ benchmarkPolicy, dataStates, experimentMatrix, scenarios, backend }) {
  const experimentPoints = [];

  for (const experiment of experimentMatrix.experiments) {
    const scenario = scenarios[experiment.scenarioId];

    if (!scenario) {
      throw new Error(`Scenario "${experiment.scenarioId}" referenced in matrix but not found`);
    }

    for (const stateName of experiment.states) {
      const state = dataStates[stateName];

      if (!state) {
        throw new Error(
          `State "${stateName}" referenced by scenario "${experiment.scenarioId}" but not found`
        );
      }

      for (const concurrency of experiment.concurrency) {
        experimentPoints.push({
          backend,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          scenarioDescription: scenario.description,
          scenario,
          stateName,
          state,
          concurrency,
          warmupRuns: benchmarkPolicy.warmupRuns,
          measuredRuns: benchmarkPolicy.measuredRuns,
          warmupDurationSeconds: benchmarkPolicy.warmupDurationSeconds,
          measuredDurationSeconds: benchmarkPolicy.measuredDurationSeconds,
          resetBeforeEachRun: benchmarkPolicy.resetBeforeEachRun,
          aggregation: benchmarkPolicy.aggregation,
          metrics: benchmarkPolicy.metrics
        });
      }
    }
  }

  return experimentPoints;
}

module.exports = {
  buildExperimentPoints
};