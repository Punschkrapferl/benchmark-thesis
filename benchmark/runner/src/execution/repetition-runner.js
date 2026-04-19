const { prepareDatabaseState } = require("../db-preparer");
const { createScenarioRuntime } = require("../workload/scenario-runtime");
const { runAutocannon } = require("./run-autocannon");

// Run one warmup repetition.
// Warmup is used to stabilize the system before the measured runs start.
// If configured, the database is reset and seeded before the warmup.
async function runWarmup({ target, experimentPoint }) {
  if (experimentPoint.resetBeforeEachRun) {
    prepareDatabaseState({
      backend: experimentPoint.backend,
      stateName: experimentPoint.stateName
    });
  }

  // Create a fresh scenario runtime so request generation starts cleanly
  // for this specific warmup repetition.
  const scenarioRuntime = createScenarioRuntime({
    scenario: experimentPoint.scenario,
    state: {
      ...experimentPoint.state,
      name: experimentPoint.stateName
    }
  });

  // Run autocannon with the warmup duration.
  return await runAutocannon({
    baseUrl: target.baseUrl,
    concurrency: experimentPoint.concurrency,
    durationSeconds: experimentPoint.warmupDurationSeconds,
    scenarioRuntime,
    title: `[WARMUP] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | c=${experimentPoint.concurrency}`
  });
}

// Run one measured repetition.
// This is the real benchmark data collection phase.
// Again, if configured, the database is reset and seeded before the run.
async function runMeasuredRepetition({ target, experimentPoint, repetitionNumber }) {
  if (experimentPoint.resetBeforeEachRun) {
    prepareDatabaseState({
      backend: experimentPoint.backend,
      stateName: experimentPoint.stateName
    });
  }

  // Create a fresh scenario runtime for this measured repetition.
  // This keeps workload generation consistent and isolated per run.
  const scenarioRuntime = createScenarioRuntime({
    scenario: experimentPoint.scenario,
    state: {
      ...experimentPoint.state,
      name: experimentPoint.stateName
    }
  });

  // Run autocannon with the measured duration.
  return await runAutocannon({
    baseUrl: target.baseUrl,
    concurrency: experimentPoint.concurrency,
    durationSeconds: experimentPoint.measuredDurationSeconds,
    scenarioRuntime,
    title: `[RUN ${repetitionNumber}] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | c=${experimentPoint.concurrency}`
  });
}

// Run all configured warmup and measured repetitions for one experiment point.
async function runRepetitions({ target, experimentPoint }) {
  const warmupResults = [];
  const measuredResults = [];

  // Execute warmup runs first.
  for (let warmupIndex = 1; warmupIndex <= experimentPoint.warmupRuns; warmupIndex += 1) {
    const warmupResult = await runWarmup({
      target,
      experimentPoint
    });

    warmupResults.push(warmupResult);
  }

  // Execute measured runs afterwards.
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