const { loadConfig } = require("./config-loader");
const { buildExperimentPoints } = require("./matrix-builder");
const { resolveTarget } = require("./target-resolver");
const { runExperiment } = require("./execution/experiment-runner");
const { writeResults } = require("./results/result-writer");

const ALLOWED_CATEGORIES = ["validation", "official"];

function parseCliArgs(argv) {
  const args = {
    backend: "express",
    category: null,
    scenario: null,
    state: null,
    concurrency: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const currentArg = argv[i];
    const nextArg = argv[i + 1];

    if (currentArg === "--backend" && nextArg) {
      args.backend = nextArg;
      i += 1;
      continue;
    }

    if (currentArg === "--category" && nextArg) {
      args.category = nextArg;
      i += 1;
      continue;
    }

    if (currentArg === "--scenario" && nextArg) {
      args.scenario = nextArg;
      i += 1;
      continue;
    }

    if (currentArg === "--state" && nextArg) {
      args.state = nextArg;
      i += 1;
      continue;
    }

    if (currentArg === "--concurrency" && nextArg) {
      const parsedConcurrency = Number(nextArg);

      if (!Number.isInteger(parsedConcurrency) || parsedConcurrency <= 0) {
        throw new Error(
          `Invalid value for --concurrency: "${nextArg}". Expected a positive integer.`
        );
      }

      args.concurrency = parsedConcurrency;
      i += 1;
      continue;
    }
  }

  if (!args.category) {
    throw new Error(
      'Missing required argument "--category". Use either "--category validation" or "--category official".'
    );
  }

  if (!ALLOWED_CATEGORIES.includes(args.category)) {
    throw new Error(
      `Invalid value for --category: "${args.category}". Allowed values: ${ALLOWED_CATEGORIES.join(", ")}`
    );
  }

  return args;
}

function filterExperimentPoints(experimentPoints, args) {
  return experimentPoints.filter((experimentPoint) => {
    if (args.scenario && experimentPoint.scenarioId !== args.scenario) {
      return false;
    }

    if (args.state && experimentPoint.stateName !== args.state) {
      return false;
    }

    if (args.concurrency !== null && experimentPoint.concurrency !== args.concurrency) {
      return false;
    }

    return true;
  });
}

function printActiveFilters(args) {
  const activeFilters = [`category=${args.category}`];

  if (args.scenario) {
    activeFilters.push(`scenario=${args.scenario}`);
  }

  if (args.state) {
    activeFilters.push(`state=${args.state}`);
  }

  if (args.concurrency !== null) {
    activeFilters.push(`concurrency=${args.concurrency}`);
  }

  console.log(`Active experiment filters: ${activeFilters.join(", ")}`);
}

function buildAppliedFilters(args) {
  return {
    scenario: args.scenario,
    state: args.state,
    concurrency: args.concurrency
  };
}

function toWallClockDurationSeconds(startedAtMs, finishedAtMs) {
  return Number(((finishedAtMs - startedAtMs) / 1000).toFixed(3));
}

async function main() {
  const runnerStartedAtMs = Date.now();
  const runnerStartedAt = new Date(runnerStartedAtMs).toISOString();

  const args = parseCliArgs(process.argv.slice(2));
  const config = loadConfig();
  const target = resolveTarget(args.backend);

  const allExperimentPoints = buildExperimentPoints({
    benchmarkPolicy: config.benchmarkPolicy,
    dataStates: config.dataStates,
    experimentMatrix: config.experimentMatrix,
    scenarios: config.scenarios,
    backend: args.backend
  });

  const filteredExperimentPoints = filterExperimentPoints(allExperimentPoints, args);

  console.log(`Loaded ${allExperimentPoints.length} experiment points for backend "${args.backend}"`);
  console.log(`Target base URL: ${target.baseUrl}`);
  printActiveFilters(args);
  console.log(`Selected ${filteredExperimentPoints.length} experiment point(s) after filtering.`);

  if (filteredExperimentPoints.length === 0) {
    throw new Error(
      "No experiment points matched the provided filters. " +
        "Check --scenario, --state, and --concurrency values."
    );
  }

  const allExperimentResults = [];

  for (let i = 0; i < filteredExperimentPoints.length; i += 1) {
    const experimentPoint = filteredExperimentPoints[i];

    console.log("");
    console.log("============================================================");
    console.log(
      `Experiment ${i + 1}/${filteredExperimentPoints.length}: ${experimentPoint.scenarioId} | state=${experimentPoint.stateName} | concurrency=${experimentPoint.concurrency}`
    );
    console.log("============================================================");
    console.log("");

    const experimentResult = await runExperiment({
      target,
      experimentPoint
    });

    allExperimentResults.push(experimentResult);

    console.log(
      `Experiment wall-clock duration: ${experimentResult.executionMetadata.wallClockDurationSeconds} s`
    );
  }

  const runnerFinishedAtMs = Date.now();
  const runnerFinishedAt = new Date(runnerFinishedAtMs).toISOString();

  const runMetadata = {
    category: args.category,
    backend: args.backend,
    targetBaseUrl: target.baseUrl,
    selectedExperimentCount: filteredExperimentPoints.length,
    appliedFilters: buildAppliedFilters(args),
    benchmarkPolicy: {
      warmupRuns: config.benchmarkPolicy.warmupRuns,
      measuredRuns: config.benchmarkPolicy.measuredRuns,
      warmupDurationSeconds: config.benchmarkPolicy.warmupDurationSeconds,
      measuredDurationSeconds: config.benchmarkPolicy.measuredDurationSeconds,
      resetBeforeEachRun: config.benchmarkPolicy.resetBeforeEachRun,
      aggregation: config.benchmarkPolicy.aggregation,
      metrics: config.benchmarkPolicy.metrics
    },
    startedAt: runnerStartedAt,
    finishedAt: runnerFinishedAt,
    wallClockDurationSeconds: toWallClockDurationSeconds(
      runnerStartedAtMs,
      runnerFinishedAtMs
    )
  };

  const writtenFiles = writeResults({
    category: args.category,
    backend: args.backend,
    allExperimentResults,
    runMetadata
  });

  console.log("");
  console.log("Benchmark run completed.");
  console.log(`Results directory: ${writtenFiles.runDirectory}`);
  console.log(`Raw JSON: ${writtenFiles.rawResultsPath}`);
  console.log(`Summary CSV: ${writtenFiles.summaryCsvPath}`);
  console.log(`Run metadata JSON: ${writtenFiles.runMetadataPath}`);
  console.log(`Total benchmark runner wall-clock duration: ${runMetadata.wallClockDurationSeconds} s`);
}

main().catch((error) => {
  console.error("Benchmark runner failed:");
  console.error(error);
  process.exit(1);
});