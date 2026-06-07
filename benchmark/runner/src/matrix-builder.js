// Resolve the numeric load axis for one matrix entry into a model-agnostic list.
//
// closed -> concurrency (number of virtual users / connections)
// open   -> arrivalRates (target requests per second)
//
// Both collapse into a single "loadLevel" value on each experiment point so the
// rest of the pipeline does not need to special-case the load model.
function resolveLoadLevels(experiment) {
  if (experiment.loadModel === "open") {
    return experiment.arrivalRates;
  }

  return experiment.concurrency;
}

// Expand the experiment matrix into a flat list of concrete experiment points.
//
// Example (closed model):
// If a matrix entry contains:
// - scenario = s1-read-only-paged
// - states = [small, medium]
// - concurrency = [1, 8]
//
// then this function creates four concrete experiment points, one per
// (state, loadLevel) combination.
function buildExperimentPoints({ benchmarkPolicy, dataStates, experimentMatrix, scenarios, backend }) {
  const experimentPoints = [];

  for (const experiment of experimentMatrix.experiments) {
    const scenario = scenarios[experiment.scenarioId];

    if (!scenario) {
      throw new Error(`Scenario "${experiment.scenarioId}" referenced in matrix but not found`);
    }

    const loadLevels = resolveLoadLevels(experiment);
    const maxVus = experiment.loadModel === "open" ? experiment.maxVus : null;

    for (const stateName of experiment.states) {
      const state = dataStates[stateName];

      if (!state) {
        throw new Error(
          `State "${stateName}" referenced by scenario "${experiment.scenarioId}" but not found`
        );
      }

      for (const loadLevel of loadLevels) {
        experimentPoints.push({
          backend,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          scenarioDescription: scenario.description,
          scenario,
          stateName,
          state,
          loadModel: experiment.loadModel,
          loadLevel,
          maxVus,
          warmupRuns: benchmarkPolicy.warmupRuns,
          measuredRuns: benchmarkPolicy.measuredRuns,
          warmupDurationSeconds: benchmarkPolicy.warmupDurationSeconds,
          measuredDurationSeconds: benchmarkPolicy.measuredDurationSeconds,
          resetBeforeEachRun: benchmarkPolicy.resetBeforeEachRun,
          requestTimeoutSeconds: benchmarkPolicy.requestTimeoutSeconds,
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