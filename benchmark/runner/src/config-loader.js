const fs = require("fs");
const path = require("path");

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required JSON file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
  }
}

function validatePolicy(policy) {
  const requiredKeys = [
    "warmupRuns",
    "measuredRuns",
    "warmupDurationSeconds",
    "measuredDurationSeconds",
    "resetBeforeEachRun",
    "aggregation",
    "metrics"
  ];

  for (const key of requiredKeys) {
    if (!(key in policy)) {
      throw new Error(`benchmark-policy.json is missing required key: ${key}`);
    }
  }
}

function validateDataStates(dataStates) {
  const requiredStates = ["empty", "small", "medium", "large"];

  for (const stateName of requiredStates) {
    if (!(stateName in dataStates)) {
      throw new Error(`data-states.json is missing required state: ${stateName}`);
    }

    const state = dataStates[stateName];
    const requiredKeys = ["rowCount", "idMin", "idMax"];

    for (const key of requiredKeys) {
      if (!(key in state)) {
        throw new Error(`State "${stateName}" is missing required key: ${key}`);
      }
    }
  }
}

function validateExperimentMatrix(matrix) {
  if (!matrix.experiments || !Array.isArray(matrix.experiments)) {
    throw new Error("experiment-matrix.json must contain an 'experiments' array");
  }

  for (const experiment of matrix.experiments) {
    const requiredKeys = ["scenarioId", "states", "concurrency"];

    for (const key of requiredKeys) {
      if (!(key in experiment)) {
        throw new Error(
          `An experiment entry in experiment-matrix.json is missing required key: ${key}`
        );
      }
    }

    if (!Array.isArray(experiment.states) || experiment.states.length === 0) {
      throw new Error(
        `Experiment "${experiment.scenarioId}" must define a non-empty states array`
      );
    }

    if (!Array.isArray(experiment.concurrency) || experiment.concurrency.length === 0) {
      throw new Error(
        `Experiment "${experiment.scenarioId}" must define a non-empty concurrency array`
      );
    }
  }
}

function validateScenario(scenario, scenarioFileName) {
  const requiredKeys = ["id", "name", "description", "operations"];

  for (const key of requiredKeys) {
    if (!(key in scenario)) {
      throw new Error(`Scenario file "${scenarioFileName}" is missing required key: ${key}`);
    }
  }

  if (!Array.isArray(scenario.operations) || scenario.operations.length === 0) {
    throw new Error(`Scenario file "${scenarioFileName}" must define a non-empty operations array`);
  }

  const totalWeight = scenario.operations.reduce((sum, operation) => {
    if (
      !operation.name ||
      !operation.method ||
      !operation.path ||
      typeof operation.weight !== "number"
    ) {
      throw new Error(
        `Scenario file "${scenarioFileName}" contains an invalid operation definition`
      );
    }

    return sum + operation.weight;
  }, 0);

  if (totalWeight !== 100) {
    throw new Error(
      `Scenario file "${scenarioFileName}" must have operation weights summing to exactly 100, got ${totalWeight}`
    );
  }
}

function loadScenarios(scenariosDirPath) {
  if (!fs.existsSync(scenariosDirPath)) {
    throw new Error(`Scenarios directory not found: ${scenariosDirPath}`);
  }

  const scenarioFileNames = fs
    .readdirSync(scenariosDirPath)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  if (scenarioFileNames.length === 0) {
    throw new Error(`No scenario JSON files found in: ${scenariosDirPath}`);
  }

  const scenariosById = {};

  for (const fileName of scenarioFileNames) {
    const fullPath = path.join(scenariosDirPath, fileName);
    const scenario = readJsonFile(fullPath);

    validateScenario(scenario, fileName);

    if (scenariosById[scenario.id]) {
      throw new Error(`Duplicate scenario id detected: ${scenario.id}`);
    }

    scenariosById[scenario.id] = scenario;
  }

  return scenariosById;
}

function loadConfig() {
  const benchmarkDir = path.resolve(__dirname, "..", "..");
  const configDir = path.join(benchmarkDir, "config");
  const scenariosDir = path.join(benchmarkDir, "scenarios");

  const benchmarkPolicy = readJsonFile(path.join(configDir, "benchmark-policy.json"));
  const dataStates = readJsonFile(path.join(configDir, "data-states.json"));
  const experimentMatrix = readJsonFile(path.join(configDir, "experiment-matrix.json"));
  const scenarios = loadScenarios(scenariosDir);

  validatePolicy(benchmarkPolicy);
  validateDataStates(dataStates);
  validateExperimentMatrix(experimentMatrix);

  return {
    benchmarkDir,
    configDir,
    scenariosDir,
    benchmarkPolicy,
    dataStates,
    experimentMatrix,
    scenarios
  };
}

module.exports = {
  loadConfig
};