const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const K6_WORKLOAD_SCRIPT = path.resolve(__dirname, "../../k6/workload.js");
const DEFAULT_K6_DOCKER_IMAGE = "grafana/k6:2.0.0";
const DEFAULT_DOCKER_NETWORK = "benchmark-net";
const DEFAULT_K6_CPUS = "2";

function resolveK6DockerImage() {
  const fromEnv = process.env.K6_DOCKER_IMAGE;

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return DEFAULT_K6_DOCKER_IMAGE;
}

function resolveDockerNetwork() {
  const fromEnv = process.env.BENCHMARK_DOCKER_NETWORK;

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return DEFAULT_DOCKER_NETWORK;
}

function resolveK6CpuLimit() {
  const fromEnv = process.env.BENCHMARK_K6_CPUS;

  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return DEFAULT_K6_CPUS;
}

function assertDockerAvailable() {
  const dockerCheck = spawnSync("docker", ["version"], {
    encoding: "utf8"
  });

  if (dockerCheck.error) {
    throw new Error(
      `Docker is not available (${dockerCheck.error.message}). ` +
        "Install Docker Desktop and ensure it is running."
    );
  }

  if (dockerCheck.status !== 0) {
    throw new Error(
      `Docker version check failed.\n${dockerCheck.stderr || dockerCheck.stdout}`
    );
  }
}

function assertK6DockerImageAvailable(k6DockerImage) {
  const imageInspect = spawnSync("docker", ["image", "inspect", k6DockerImage], {
    encoding: "utf8"
  });

  if (imageInspect.status === 0) {
    return;
  }

  console.log(`Pulling k6 Docker image: ${k6DockerImage}`);

  const imagePull = spawnSync("docker", ["pull", k6DockerImage], {
    encoding: "utf8",
    stdio: "inherit"
  });

  if (imagePull.status !== 0) {
    throw new Error(`Failed to pull k6 Docker image "${k6DockerImage}"`);
  }
}

function assertK6Available() {
  assertDockerAvailable();
  assertK6DockerImageAvailable(resolveK6DockerImage());
}

// Build the model-specific k6 env args.
// closed -> BENCH_VUS (concurrent clients)
// open   -> BENCH_RATE (req/s) + BENCH_MAX_VUS (in-flight cap before load shedding)
function buildLoadModelEnvArgs(experimentPoint) {
  if (experimentPoint.loadModel === "open") {
    return [
      "-e",
      `BENCH_RATE=${String(experimentPoint.loadLevel)}`,
      "-e",
      `BENCH_MAX_VUS=${String(experimentPoint.maxVus)}`
    ];
  }

  return ["-e", `BENCH_VUS=${String(experimentPoint.loadLevel)}`];
}

// Run one k6 benchmark inside Docker on the benchmark network.
function runK6({ baseUrl, experimentPoint, durationSeconds, title }) {
  const k6DockerImage = resolveK6DockerImage();
  const dockerNetwork = resolveDockerNetwork();
  const k6CpuLimit = resolveK6CpuLimit();

  assertK6DockerImageAvailable(k6DockerImage);

  if (!fs.existsSync(K6_WORKLOAD_SCRIPT)) {
    throw new Error(`k6 workload script not found: ${K6_WORKLOAD_SCRIPT}`);
  }

  const outputDirectory = path.join(
    os.tmpdir(),
    `benchmark-k6-output-${process.pid}-${Date.now()}`
  );
  fs.mkdirSync(outputDirectory, { recursive: true });

  const summaryFileHostPath = path.join(outputDirectory, "summary.json");
  const summaryFileContainerPath = "/output/summary.json";
  const workloadContainerPath = "/scripts/workload.js";

  const statePayload = {
    ...experimentPoint.state,
    name: experimentPoint.stateName
  };

  console.log(`[k6] ${title} (docker:${k6DockerImage})`);

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    dockerNetwork,
    "--cpus",
    k6CpuLimit,
    "-v",
    `${K6_WORKLOAD_SCRIPT}:${workloadContainerPath}:ro`,
    "-v",
    `${outputDirectory}:/output`,
    "-e",
    `BENCH_BASE_URL=${baseUrl}`,
    "-e",
    `BENCH_OPERATIONS=${JSON.stringify(experimentPoint.scenario.operations)}`,
    "-e",
    `BENCH_STATE=${JSON.stringify(statePayload)}`,
    "-e",
    `BENCH_LOAD_MODEL=${experimentPoint.loadModel}`,
    "-e",
    `BENCH_REQUEST_TIMEOUT=${experimentPoint.requestTimeoutSeconds}s`,
    "-e",
    `BENCH_DURATION=${durationSeconds}s`,
    ...buildLoadModelEnvArgs(experimentPoint),
    k6DockerImage,
    "run",
    "--summary-export",
    summaryFileContainerPath,
    "--quiet",
    workloadContainerPath
  ];

  const k6Result = spawnSync("docker", dockerArgs, {
    encoding: "utf8"
  });

  if (k6Result.status !== 0) {
    const details = k6Result.stderr || k6Result.stdout || "unknown k6 error";

    fs.rmSync(outputDirectory, { recursive: true, force: true });

    throw new Error(`k6 benchmark failed for "${title}":\n${details}`);
  }

  if (!fs.existsSync(summaryFileHostPath)) {
    fs.rmSync(outputDirectory, { recursive: true, force: true });

    throw new Error(`k6 did not produce summary export at: ${summaryFileHostPath}`);
  }

  const summaryJson = fs.readFileSync(summaryFileHostPath, "utf8");
  fs.rmSync(outputDirectory, { recursive: true, force: true });

  let summary;

  try {
    summary = JSON.parse(summaryJson);
  } catch (error) {
    throw new Error(`Failed to parse k6 summary JSON: ${error.message}`);
  }

  return {
    title,
    raw: summary
  };
}

module.exports = {
  runK6,
  resolveK6DockerImage,
  resolveDockerNetwork,
  assertK6Available
};
