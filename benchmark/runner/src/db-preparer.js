const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT_BY_BACKEND = Object.freeze({
  express: path.join("scripts", "express", "reset-and-seed-express-db-state.sh"),
  springboot: path.join("scripts", "springboot", "reset-and-seed-springboot-db-state.sh"),
  aspnet: path.join("scripts", "aspnet", "reset-and-seed-aspnet-db-state.sh"),
  fastapi: path.join("scripts", "fastapi", "reset-and-seed-fastapi-db-state.sh")
});

const VALID_STATES = new Set(["empty", "small", "medium", "large"]);

function runScript(scriptPath, args = [], cwd) {
  const result = spawnSync(scriptPath, args, {
    cwd,
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw new Error(`Failed to execute script "${scriptPath}": ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Script "${scriptPath}" exited with status ${result.status}`);
  }
}

function resolveResetAndSeedScriptPath(backend, repoRoot) {
  const relativeScriptPath = SCRIPT_BY_BACKEND[backend];

  if (!relativeScriptPath) {
    throw new Error(
      `Unsupported backend "${backend}" for database preparation. ` +
      `Supported backends: ${Object.keys(SCRIPT_BY_BACKEND).join(", ")}`
    );
  }

  const absoluteScriptPath = path.join(repoRoot, relativeScriptPath);

  if (!fs.existsSync(absoluteScriptPath)) {
    throw new Error(
      `Could not find reset-and-seed script for backend "${backend}": ${absoluteScriptPath}`
    );
  }

  return absoluteScriptPath;
}

function validateStateName(stateName) {
  if (!stateName) {
    throw new Error("Missing benchmark state name for database preparation");
  }

  if (!VALID_STATES.has(stateName)) {
    throw new Error(
      `Unsupported benchmark state "${stateName}". ` +
      `Supported states: ${Array.from(VALID_STATES).join(", ")}`
    );
  }
}

function prepareDatabaseState({ backend, stateName }) {
  validateStateName(stateName);

  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const scriptPath = resolveResetAndSeedScriptPath(backend, repoRoot);

  runScript(scriptPath, [stateName], repoRoot);
}

module.exports = {
  prepareDatabaseState
};