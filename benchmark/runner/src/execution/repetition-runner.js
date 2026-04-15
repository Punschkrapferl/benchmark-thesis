const { prepareDatabaseState } = require("../db-preparer");
const { createScenarioRuntime } = require("../workload/scenario-runtime");
const { runAutocannon } = require("./run-autocannon");

async function runWarmup({ target, experimentPoint }) {
  if (experimentPoint.resetBeforeEachRun) {
    prepareDatabaseState({
      backend: experimentPoint.backend,
      stateName: experimentPoint.stateName
    });
  }

  const scenarioRuntime = createScenarioRuntime({
    scenario: experimentPoint.scenario,
    state: {
      ...experimentPoint.state,
      name: experimentPoint.stateName
    }
  });

  return await runAutocannon({
    baseUrl: target.baseUrl,
    concurrency: experimentPoint.concurrency,
    durationSeconds: experimentPoint.warmupDurationSeconds,
    scenarioRuntime,
    title: `[WARMUP] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | c=${experimentPoint.concurrency}`
  });
}

async function runMeasuredRepetition({ target, experimentPoint, repetitionNumber }) {
  if (experimentPoint.resetBeforeEachRun) {
    prepareDatabaseState({
      backend: experimentPoint.backend,
      stateName: experimentPoint.stateName
    });
  }

  const scenarioRuntime = createScenarioRuntime({
    scenario: experimentPoint.scenario,
    state: {
      ...experimentPoint.state,
      name: experimentPoint.stateName
    }
  });

  return await runAutocannon({
    baseUrl: target.baseUrl,
    concurrency: experimentPoint.concurrency,
    durationSeconds: experimentPoint.measuredDurationSeconds,
    scenarioRuntime,
    title: `[RUN ${repetitionNumber}] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | c=${experimentPoint.concurrency}`
  });
}

async function runRepetitions({ target, experimentPoint }) {
  const warmupResults = [];
  const measuredResults = [];

  for (let warmupIndex = 1; warmupIndex <= experimentPoint.warmupRuns; warmupIndex += 1) {
    const warmupResult = await runWarmup({
      target,
      experimentPoint
    });

    warmupResults.push(warmupResult);
  }

  for (
    let repetitionNumber = 1;
    repetitionNumber <= experimentPoint.measuredRuns;
    repetitionNumber += 1
  ) {
    const measuredResult = await runMeasuredRepetition({
      target,
      experimentPoint,
      repetitionNumber
    });

    measuredResults.push(measuredResult);
  }

  return {
    warmupResults,
    measuredResults
  };
}

module.exports = {
  runRepetitions
};