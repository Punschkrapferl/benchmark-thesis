# Project Documentation

This document contains the detailed methodology, architecture notes, benchmark configuration, parity verification process, workload model, concurrency model, result format, design decisions, and limitations for the backend benchmark thesis project.

It is intentionally more detailed than the main README and serves as the main technical documentation and thesis-writing reference.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [Architecture Notes](#2-architecture-notes)
3. [Backend Endpoint Mapping](#3-backend-endpoint-mapping)
4. [Benchmark Runner Workflow](#4-benchmark-runner-workflow)
5. [Project Structure](#5-project-structure)
6. [Benchmark Configuration](#6-benchmark-configuration)
7. [Benchmark Policy](#7-benchmark-policy)
8. [Experiment Points](#8-experiment-points)
9. [Data States](#9-data-states)
10. [Experiment Matrix](#10-experiment-matrix)
11. [Scenario Definitions](#11-scenario-definitions)
12. [Workload Generation](#12-workload-generation)
13. [Workload Execution and Concurrency Model](#13-workload-execution-and-concurrency-model)
14. [Database Preparation](#14-database-preparation)
15. [Result Processing](#15-result-processing)
16. [Result Output](#16-result-output)
17. [API Parity Verification](#17-api-parity-verification)
18. [Containerization and Runtime Consistency](#18-containerization-and-runtime-consistency)
19. [Express Backend Example](#19-express-backend-example)
20. [Environment Preparation for Official Runs](#20-environment-preparation-for-official-runs)
21. [Command Execution Rules](#21-command-execution-rules)
22. [Design Decisions](#22-design-decisions)
23. [Limitations](#23-limitations)

---

## 1. Project Purpose

The purpose of this project is to build a reproducible benchmarking framework for comparing equivalent REST Todo API implementations across multiple backend technologies.

The focus is not only on raw performance numbers, but also on the methodology used to obtain them. The project therefore emphasizes:

- equivalent API behavior across backends
- controlled benchmark scenarios
- reproducible database states
- repeated measurements
- median-based aggregation
- transparent result output
- clear separation between benchmark configuration and benchmark execution

The benchmark is intended to answer questions such as:

- How does performance scale with increasing concurrency?
- How does dataset size influence latency and throughput?
- How do backend frameworks behave under read-heavy, write-heavy, and mixed workloads?
- How stable are the results across repeated benchmark runs?

---

## 2. Architecture Notes

The benchmarking system consists of four main parts:

1. **Backend implementations**  
   The systems under test. Each backend implements the same REST Todo API.

2. **Benchmark runner**  
   A Node.js-based runner that loads configuration, prepares database states, generates workloads, executes benchmarks, extracts metrics, aggregates results, and writes output files.

3. **PostgreSQL database**  
   A shared PostgreSQL service model with backend-specific databases.

4. **Automation scripts and Docker Compose runtime**  
   Docker Compose starts the services. Shell scripts handle database reset, seeding, verification, and parity checks.

### Architecture Diagram

![Architecture Diagram](screenshots/architecture_diagram.png)

### Workflow Activity Diagram

![Activity Diagram](screenshots/activity_diagram.png)

---

## 3. Backend Endpoint Mapping

The benchmark runner resolves the target backend based on the selected `--backend` argument.

| Backend     | Base URL                |
| ----------- | ----------------------- |
| Express     | `http://127.0.0.1:3001` |
| Spring Boot | `http://127.0.0.1:8080` |
| ASP.NET     | `http://127.0.0.1:8081` |
| FastAPI     | `http://127.0.0.1:8082` |

This mapping is implemented in:

```text
benchmark/runner/src/target-resolver.js
```

The runner sends benchmark traffic only to the selected backend for a given run.

---

## 4. Benchmark Runner Workflow

The benchmark runner follows this high-level execution flow:

```text
Parse CLI arguments
→ load benchmark configuration
→ validate configuration
→ resolve selected backend target URL
→ expand experiment matrix
→ apply optional filters
→ execute selected experiment points sequentially
→ extract metrics
→ aggregate measured repetitions
→ write result files
```

For each selected experiment point, the runner performs:

1. Select one backend, scenario, data state, and concurrency level
2. Start the experiment timer
3. Execute configured warmup runs
4. Execute configured measured runs
5. Extract throughput, latency, and error metrics from measured runs
6. Aggregate measured metrics using the median
7. Build one structured experiment result

After all selected experiment points are finished, the runner:

1. Builds run metadata
2. Creates a timestamped result directory
3. Writes `raw-results.json`
4. Writes `summary.csv`
5. Writes `run-metadata.json`
6. Prints the result paths

---

## 5. Project Structure

```text
benchmark/
  runner/
    src/
      execution/
        experiment-runner.js
        repetition-runner.js
        run-autocannon.js

      results/
        aggregate.js
        metrics.js
        result-writer.js

      workload/
        request-generators.js
        scenario-runtime.js

      config-loader.js
      db-preparer.js
      index.js
      matrix-builder.js
      target-resolver.js

  config/
    benchmark-policy.json
    data-states.json
    experiment-matrix.json

  scenarios/
    s1-read-only.json
    s2-write.json
    s3-mixed-crud.json

  results/
    validation/
    official/
```

Additional top-level areas include:

```text
backends/
  express/
  springboot/
  aspnet/
  fastapi/

db/
  init/
  reset/
  seed/

scripts/
  common/
  express/
  springboot/
  aspnet/
  fastapi/
```

---

## 6. Benchmark Configuration

The benchmark is controlled through JSON files rather than hardcoded runner logic.

The main configuration files are:

```text
benchmark/config/benchmark-policy.json
benchmark/config/data-states.json
benchmark/config/experiment-matrix.json
benchmark/scenarios/*.json
```

This separation allows benchmark settings to be changed without modifying the runner implementation.

Together, these files define:

- benchmark policy
- available data states
- scenarios
- scenario operation weights
- selected experiment matrix
- concurrency levels
- warmup and measured run counts
- result aggregation policy

---

## 7. Benchmark Policy

The benchmark policy defines global measurement behavior.

Current policy:

| Setting               | Value      |
| --------------------- | ---------- |
| Warmup runs           | 1          |
| Measured runs         | 5          |
| Warmup duration       | 30 seconds |
| Measured duration     | 60 seconds |
| Reset before each run | true       |
| Aggregation method    | median     |

Warmup runs are used to stabilize the system before measured repetitions begin. Warmup results are stored in the raw output, but they are not used for final metric aggregation.

Measured runs are aggregated using the median to reduce the influence of outliers and short-lived measurement noise.

---

## 8. Experiment Points

An experiment point is one concrete benchmark configuration consisting of:

```text
backend + scenario + data state + concurrency level
```

Example:

```text
express + s1-read-only + medium + concurrency 8
```

The experiment matrix is expanded by:

```text
benchmark/runner/src/matrix-builder.js
```

For each matrix entry, the runner creates one concrete experiment point for every selected data state and concurrency value.

---

## 9. Data States

The benchmark uses defined initial database sizes.

| State  | Rows    |
| ------ | ------- |
| empty  | 0       |
| small  | 100     |
| medium | 10,000  |
| large  | 100,000 |

Each state also defines an ID range. This range is used by the workload generator for operations such as:

```text
GET /todos/:id
PATCH /todos/:id
DELETE /todos/:id
```

If a state has no valid ID range, the request generator cannot generate `:id` paths for that state.

---

## 10. Experiment Matrix

The current experiment matrix is:

### S1 Read-Only

| State  | Concurrency |
| ------ | ----------- |
| small  | 1, 8, 32    |
| medium | 1, 8, 32    |
| large  | 1, 8, 32    |

Total:

```text
9 experiment points
```

### S2 Write

| State | Concurrency |
| ----- | ----------- |
| empty | 1, 8, 32    |
| small | 1, 8, 32    |

Total:

```text
6 experiment points
```

### S3 Mixed CRUD

| State  | Concurrency |
| ------ | ----------- |
| medium | 8, 32       |

Total:

```text
2 experiment points
```

Across all four backends, this produces:

```text
17 experiment points per backend
68 experiment points total
```

Each experiment point contains:

```text
1 warmup run
5 measured runs
```

---

## 11. Scenario Definitions

Scenario files define the workload composition by specifying HTTP operations and operation weights.

Scenario weights must sum to exactly `100`. This is validated by the configuration loader.

### S1 Read-Only Baseline

```text
80% GET /todos
20% GET /todos/:id
```

This scenario is used to analyze read-heavy behavior.

It is useful for examining:

- dataset-size effects on read performance
- throughput under read-heavy traffic
- latency stability under mostly retrieval-based load

### S2 Write Baseline

```text
100% POST /todos
```

This scenario is used to analyze pure insert behavior.

It is useful for examining:

- write throughput
- insert latency
- stability of create operations under concurrent load

Request bodies are generated dynamically from a template:

```json
{
  "title": "{{title}}",
  "completed": false,
  "order": "{{order}}"
}
```

At runtime, placeholders are replaced with generated values.

### S3 Mixed CRUD

```text
50% GET /todos
20% GET /todos/:id
15% POST /todos
15% PATCH /todos/:id
```

This scenario represents a non-destructive mixed workload.

`DELETE /todos/:id` is intentionally excluded from the official S3 performance scenario. DELETE remains implemented and parity-tested, but it is not part of the measured mixed workload.

The reason is methodological: DELETE changes the availability of resources during a benchmark run. If a later request targets an already deleted todo item, the backend correctly returns `404 Not Found`. Load-testing tools count non-2xx responses as errors, which would make the error rate harder to interpret.

Therefore, the official S3 workload focuses on read, create, and update behavior.

---

## 12. Workload Generation

Workload generation happens dynamically at runtime.

The relevant files are:

```text
benchmark/runner/src/workload/scenario-runtime.js
benchmark/runner/src/workload/request-generators.js
```

The request generator is responsible for:

- selecting operations according to configured weights
- resolving dynamic paths such as `/todos/:id`
- generating request bodies from templates
- producing backend-independent HTTP request definitions

### Weighted Operation Selection

The operation weights are expanded into a fixed-size pool of 100 entries.

Example:

```text
80% GET /todos
20% GET /todos/:id
```

becomes:

```text
80 list operations
20 get-by-id operations
```

The request generator randomly selects from this expanded pool.

### Dynamic Path Resolution

For paths containing `:id`, the generator selects a random ID between the configured `idMin` and `idMax` of the selected data state.

Example:

```text
/todos/:id
```

may become:

```text
/todos/4721
```

### Dynamic Body Generation

For body templates, placeholders are replaced dynamically.

Examples:

```text
{{title}}     → benchmark-todo-N
{{order}}     → N
{{completed}} → alternating boolean value
```

---

## 13. Workload Execution and Concurrency Model

The benchmark separates workload definition from workload execution.

Scenario files describe what type of requests should be generated. The benchmark runner turns those definitions into actual HTTP requests through the dynamic request generator.

Concurrency is produced by the load generator, not by manually created worker threads in the benchmark runner.

The runner uses:

```text
autocannon
```

Autocannon is configured with:

```text
connections = selected concurrency level
pipelining = 1
duration = warmup or measured duration
```

### Meaning of Concurrency

In this benchmark, concurrency means:

```text
number of simultaneous client connections to the selected backend
```

It does not mean:

- number of experiment points running in parallel
- number of benchmark runner processes
- number of custom worker threads

Experiment points are executed sequentially, but requests within one experiment point are sent concurrently.

### Sequential Experiment Execution

The runner executes experiment points sequentially to avoid interference between measurements.

This avoids:

- CPU contention between experiment points
- memory interference
- disk I/O overlap
- mixed backend load
- unclear attribution of results

The benchmark follows this model:

```text
sequential experiment scheduling + concurrent HTTP request execution
```

### Backend-Side Concurrency

The benchmark standardizes external load conditions. Each backend handles incoming requests according to its own runtime model.

Examples:

- Express uses Node.js event-loop-based asynchronous handling
- Spring Boot commonly uses thread-pool-based request handling
- ASP.NET uses a managed runtime with asynchronous request handling and thread-pool scheduling
- FastAPI commonly runs on an ASGI-based asynchronous model

This is intentional. The benchmark compares how each framework behaves under the same external load conditions.

---

## 14. Database Preparation

Database preparation is handled through:

```text
benchmark/runner/src/db-preparer.js
```

For each backend, `db-preparer.js` resolves a backend-specific reset-and-seed script.

Example mapping:

```text
express    → scripts/express/reset-and-seed-express-db-state.sh
springboot → scripts/springboot/reset-and-seed-springboot-db-state.sh
aspnet     → scripts/aspnet/reset-and-seed-aspnet-db-state.sh
fastapi    → scripts/fastapi/reset-and-seed-fastapi-db-state.sh
```

When `resetBeforeEachRun` is enabled, the selected backend database is reset and seeded before each warmup and measured repetition.

This ensures that every run starts from a defined logical state.

---

## 15. Result Processing

After measured repetitions complete, the runner extracts metrics from raw autocannon output.

Relevant files:

```text
benchmark/runner/src/results/metrics.js
benchmark/runner/src/results/aggregate.js
benchmark/runner/src/results/result-writer.js
```

### Extracted Metrics

The benchmark extracts:

| Metric         | Meaning                       |
| -------------- | ----------------------------- |
| throughput     | average requests per second   |
| latency_median | p50 latency                   |
| latency_p90    | 90th percentile latency       |
| latency_p99    | 99th percentile latency       |
| error_rate     | proportion of failed requests |

### Error Rate

The error rate is computed from:

```text
errors + timeouts + non2xx
```

The denominator is chosen from the best available request count:

1. completed requests
2. sent requests
3. failure count, if no better denominator exists

This makes the error rate robust even when some result fields are missing.

### Median Aggregation

Each measured metric is aggregated independently using the median.

Example:

```text
measured throughput values → median throughput
measured p90 values        → median p90
measured error rates       → median error rate
```

Median is used because it is less sensitive to outliers than arithmetic mean.

---

## 16. Result Output

Each benchmark run creates a timestamped result directory:

```text
benchmark/results/<category>/<backend>/<timestamp>/
```

Each run writes:

```text
raw-results.json
summary.csv
run-metadata.json
```

### raw-results.json

Contains the full structured benchmark result, including:

- backend
- scenario
- state
- concurrency
- warmup results
- measured results
- measured metrics
- aggregated metrics
- experiment execution metadata

### summary.csv

Contains a compact table of aggregated metrics.

Columns:

```text
backend
scenarioId
stateName
concurrency
throughput
latency_median
latency_p90
latency_p99
error_rate
```

### run-metadata.json

Contains metadata for the full benchmark runner execution.

Examples:

- category
- backend
- target base URL
- selected experiment count
- applied filters
- benchmark policy
- start timestamp
- finish timestamp
- wall-clock duration

---

## 17. API Parity Verification

Before performance benchmarking, backend implementations are checked for strict API parity.

Express is used as the reference implementation.

The other backends are compared against Express:

```text
ASP.NET
FastAPI
Spring Boot
```

The purpose is to ensure that performance results are not distorted by differences in API behavior.

### What Is Compared

The parity scripts compare:

- numeric HTTP status codes
- relevant response headers
- JSON response body structure
- exact error messages
- malformed JSON handling
- invalid ID handling
- unknown route handling
- partial update semantics
- delete semantics
- selected validation edge cases

### Example Cases

Examples include:

```text
GET /todos
GET /todos/:id
GET /todos/abc
GET unknown route
POST /todos
POST malformed JSON
POST invalid field types
PATCH with order: null
PATCH with unknown fields
PATCH invalid IDs
DELETE /todos/:id
DELETE /todos
GET /todos after delete all
```

DELETE is still covered here even though it is excluded from the official S3 performance scenario.

### Deterministic Setup

Each parity script:

1. Verifies that both compared backends are reachable
2. Resets both databases
3. Seeds deterministic initial todo rows
4. Captures created IDs dynamically
5. Runs the same logical HTTP test cases against both backends
6. Normalizes irrelevant transport-level differences
7. Compares status codes, headers, and bodies
8. Exits with failure if mismatches are found

### Normalization

The scripts normalize framework-specific HTTP formatting differences that are not semantically relevant.

Examples:

- numeric status codes instead of full reason phrases
- removal of unstable headers such as `Date`
- normalization of JSON content types
- replacement of backend-specific base URLs in response bodies

This keeps the parity check focused on API behavior rather than framework-specific transport formatting.

---

## 18. Containerization and Runtime Consistency

All backends run through Docker Compose.

Containerization improves methodological consistency by ensuring that:

- services are started in a consistent way
- backends run in isolated containers
- each backend connects to PostgreSQL through a comparable service setup
- startup, shutdown, and verification can be automated
- local environment differences are reduced

Docker Compose is started outside the benchmark runner. The runner assumes the selected backend and PostgreSQL are already running.

---

## 19. Express Backend Example

The Express backend is the reference implementation for API parity.

Its internal structure follows a layered design:

```text
server.js
→ app.js
→ todo-routes.js
→ todo-controller.js
→ todo-service.js
→ todo-repository.js
→ database.js
→ PostgreSQL
```

Supporting layers include:

```text
todo-serializer.js
error-handler.js
not-found.js
```

### Layer Responsibilities

| Layer                | Responsibility                                    |
| -------------------- | ------------------------------------------------- |
| `server.js`          | Starts the application and handles shutdown       |
| `app.js`             | Configures middleware, routes, and error handling |
| `todo-routes.js`     | Maps endpoints to controller functions            |
| `todo-controller.js` | Handles request/response flow                     |
| `todo-service.js`    | Handles validation and todo logic                 |
| `todo-repository.js` | Executes SQL queries                              |
| `database.js`        | Manages PostgreSQL connection pool                |
| `todo-serializer.js` | Converts DB rows into public API responses        |
| `error-handler.js`   | Handles application and JSON errors               |
| `not-found.js`       | Handles unknown routes                            |

---

## 20. Environment Preparation for Official Runs

Before official benchmark runs, the machine should be prepared to reduce noise.

Recommended steps:

- close unnecessary applications
- stop unrelated development tools
- avoid browser-heavy workloads
- avoid sync clients, downloads, and media applications
- ensure Docker is running properly
- allow the system to remain idle during official runs
- avoid running unrelated background tasks during measurement

Benchmark results can be influenced by CPU scheduling, memory pressure, disk I/O, Docker resource limits, and background processes.

---

## 21. Command Execution Rules

All commands should be executed from the repository root.

This matters because:

- Docker Compose expects root-level paths
- helper scripts resolve paths relative to the repository root
- benchmark runner paths are based on the project structure
- database reset and seed scripts depend on relative paths

Running commands from subdirectories may cause missing-file or path-resolution errors.

---

## 22. Design Decisions

### Configuration-Driven Benchmarking

Benchmark settings are externalized into JSON files.

This improves:

- reproducibility
- transparency
- extensibility

### Median Aggregation

Median aggregation is used to reduce the impact of outliers.

### Reset Before Each Run

Resetting and seeding before runs ensures comparable starting conditions.

### Dynamic Workload Generation

Requests are generated dynamically rather than replayed from a static list.

This allows scenarios to be reused across data states and backends.

### Express as API Reference

Express is used as the parity reference to avoid all-pairs comparison complexity.

If every backend matches the Express reference, they can be treated as functionally equivalent for the benchmark.

### Non-Destructive S3 Workload

DELETE is excluded from the measured mixed workload to avoid expected 404 responses affecting benchmark error-rate interpretation.

---

## 23. Limitations

The framework is designed for controlled local benchmarking, but some limitations remain:

- results depend on the hardware and operating system
- Docker improves consistency but does not remove all runtime differences
- backend implementations may still differ internally
- framework-specific runtime behavior remains part of what is measured
- local system noise can influence results
- database behavior may be affected by caching and I/O state
- benchmark results should not be generalized beyond the tested setup without caution
