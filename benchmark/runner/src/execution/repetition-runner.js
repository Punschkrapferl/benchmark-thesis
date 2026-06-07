const { prepareDatabaseState } = require("../db-preparer");
const { runK6 } = require("./run-k6");

// Human-readable load label for run titles.
// open -> rate=<req/s>, closed -> c=<vus>
function formatLoad(experimentPoint) {
  if (experimentPoint.loadModel === "open") {
    return `rate=${experimentPoint.loadLevel}/s`;
  }

  return `c=${experimentPoint.loadLevel}`;
}

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

  return runK6({
    baseUrl: target.baseUrl,
    experimentPoint,
    durationSeconds: experimentPoint.warmupDurationSeconds,
    title: `[WARMUP] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | ${formatLoad(experimentPoint)}`
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

  return runK6({
    baseUrl: target.baseUrl,
    experimentPoint,
    durationSeconds: experimentPoint.measuredDurationSeconds,
    title: `[RUN ${repetitionNumber}] ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | ${formatLoad(experimentPoint)}`
  });
}

// Run all configured warmup and measured repetitions for one experiment point.
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
