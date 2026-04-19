# Backend Benchmark Framework

## Overview

This project implements a reproducible benchmarking framework for comparing the performance of different backend implementations of a RESTful Todo API. The benchmark evaluates how each backend behaves under varying workloads, dataset sizes, and concurrency levels.

The primary goal is to measure and compare:

- **Throughput** (requests per second)
- **Latency** (median, p90, p99)
- **Error rate**

The framework is designed to ensure fairness, reproducibility, and extensibility by separating benchmark configuration from benchmark execution logic.

A central design decision of this project is that **all backend implementations are containerized**. This ensures that all systems under test start from a comparable runtime setup, are started in a consistent way, and can be automated uniformly through Docker Compose.

---

## Supported Backends

The benchmark framework currently supports the following backend implementations:

- Express (Node.js)
- Spring Boot (Java)
- ASP.NET (C#)
- FastAPI (Python)

Each backend exposes the same REST API contract and is benchmarked under identical workload and database conditions.

---

## Benchmark Goal

The purpose of this project is not simply to compare programming languages or frameworks in isolation. Instead, it provides a controlled methodology for analyzing how comparable backend implementations behave under defined experimental conditions.

The benchmark is intended to answer questions such as:

- How does performance scale with increasing concurrency?
- How does dataset size influence latency and throughput?
- How do frameworks behave under read-heavy, write-heavy, and mixed workloads?
- How stable is each backend under repeated, automated execution?

---

## System Architecture

The benchmarking system consists of four main parts:

1. **Backend implementations**  
   The systems under test. Each backend implements the same Todo API.

2. **Benchmark runner**  
   A Node.js-based runner that loads configuration, prepares database states, generates workloads, executes benchmarks, and writes results.

3. **PostgreSQL database**  
   A shared PostgreSQL instance with a separate database for each backend.

4. **Automation scripts and container runtime**  
   Docker Compose is used to start backends and PostgreSQL in a consistent way. Shell scripts handle reset, seed, verification, startup, and shutdown steps.

### Backend Endpoints

Each backend is exposed via a local HTTP endpoint:

| Backend     | Base URL              |
| ----------- | --------------------- |
| Express     | http://127.0.0.1:3001 |
| Spring Boot | http://127.0.0.1:8080 |
| ASP.NET     | http://127.0.0.1:8081 |
| FastAPI     | http://127.0.0.1:8082 |

The benchmark runner resolves the correct target endpoint based on the selected backend.

### High-Level Workflow

The overall benchmark flow is:

**Configuration → Experiment generation → Database preparation → Workload execution → Metric extraction → Aggregation → Result writing**

For each experiment point, the process is:

1. Select one backend, scenario, data state, and concurrency level
2. Reset and seed the corresponding database
3. Execute a warmup run
4. Execute multiple measured runs
5. Extract metrics from the measured runs
6. Aggregate the measured results using the median
7. Write the results to timestamped output directory

---

## Project Structure

```text
benchmark/
  runner/
    src/
      execution/          # Core execution logic (autocannon, repetitions, experiments)
      results/            # Metric extraction, aggregation, result writing
      workload/           # Dynamic request generation
      config-loader.js    # Loads and validates JSON configuration
      matrix-builder.js   # Expands experiment matrix into experiment points
      db-preparer.js      # Resets and seeds the database
      target-resolver.js  # Maps backend names to base URLs
      index.js            # Main benchmark runner entry point

  config/
    benchmark-policy.json
    data-states.json
    experiment-matrix.json

  scenarios/
    s1-read-only.json
    s2-write.json
    s3-mixed-crud.json

  results/                # Generated benchmark output
```

Additional top-level directories in the repository include the backend implementations, database initialization/reset/seed files, Docker Compose configuration, and backend-specific helper scripts.

---

## Benchmark Methodology

Each benchmark is executed as a series of **experiment points**.

An experiment point is defined by:

- a **scenario** (workload type)
- a **data state** (initial database size)
- a **concurrency level**

### Execution Policy

For each experiment point:

1. The database is reset and seeded into a defined state. Resetting and reseeding before each run ensures that every repetition starts from an identical logical database state, which is essential for reproducibility and fair comparison.
2. One warmup run is executed.
3. Five measured runs are executed.
4. Metrics are extracted from each measured run.
5. The final result is aggregated using the median.

This approach reduces noise and improves the reproducibility of the results.

Warmup runs are used exclusively to stabilize the system (e.g., connection pools, caches, and runtime optimizations). Metrics collected during warmup are **not included** in the final result aggregation.

### Sequential Execution of Experiment Points

Experiment points are executed sequentially rather than in parallel. This avoids interference between runs, such as shared CPU, memory, or I/O contention, and helps ensure that each measurement reflects only the selected workload conditions.

---

## Fairness Assumptions

To support meaningful comparison, the benchmark follows these assumptions:

- all backends implement the same Todo API contract
- all backends use PostgreSQL
- all benchmarks use identical scenarios, data states, and concurrency levels
- all runs follow the same warmup and repetition policy
- database reset and seeding are performed consistently before each run
- backend startup and runtime handling are standardized through Docker Compose as far as practically possible

These assumptions do not remove all real-world differences, but they help ensure that the benchmark compares implementations under controlled and transparent conditions.

---

## Benchmark Configuration

The benchmark is fully controlled via JSON configuration files. This allows workload definitions and measurement settings to be changed without modifying the runner code.

Together, these files define:

- which workload should be generated
- which data state should be used
- which concurrency levels should be tested
- how often runs should be repeated
- which metrics should be reported

This separation of configuration and execution is a central design decision of the benchmark framework.

---

## Scenario Definitions

Scenario files in `scenarios/` define the workload composition by specifying HTTP operations and their relative weights.

### S1 – Read-Only Baseline

- 80%: `GET /todos`
- 20%: `GET /todos/:id`

This scenario represents a read-dominated workload and is used to analyze backend behavior under mostly retrieval-based traffic.

It is useful for examining:

- the effect of dataset size on read performance
- the effect of concurrency on read throughput
- the stability of latency under read-heavy load

### S2 – Write Baseline

- 100%: `POST /todos`

This scenario represents a pure create workload. All generated requests insert new todo items.

It is useful for examining:

- insert performance under load
- write throughput stability
- differences between read-heavy and write-heavy behavior

Request bodies are generated dynamically from a template, for example:

```json
{
  "title": "{{title}}",
  "completed": false,
  "order": "{{order}}"
}
```

At runtime, placeholders such as `{{title}}` and `{{order}}` are replaced with generated values.

### S3 – Mixed CRUD

- 50%: `GET /todos`
- 20%: `GET /todos/:id`
- 15%: `POST /todos`
- 10%: `PATCH /todos/:id`
- 5%: `DELETE /todos/:id`

This scenario represents a mixed workload with both reads and writes. It is intended to approximate a more realistic application setting in which different types of operations occur together.

It is useful for examining:

- how reads and writes interact under load
- whether contention changes latency behavior
- whether mixed workloads reveal bottlenecks not visible in pure baseline scenarios

---

## Benchmark Policy

The file `benchmark-policy.json` defines the global execution and measurement policy for all experiments.

Current policy:

- **Warmup runs:** 1
- **Measured runs:** 5
- **Warmup duration:** 30 seconds
- **Measured duration:** 60 seconds
- **Reset before each run:** true
- **Aggregation method:** median

### Collected Metrics

The benchmark currently reports:

- **throughput**
- **latency_median**
- **latency_p90**
- **latency_p99**
- **error_rate**

The error rate represents the proportion of failed requests relative to the best available request count reported by the load generator. This includes non-success HTTP responses (non-2xx), timeouts, and connection-level failures.

These metrics provide both a general performance view and a view of tail latency and stability.

---

## Data States

The file `data-states.json` defines the initial database sizes used during benchmarking.

| State  | Rows    |
| ------ | ------- |
| empty  | 0       |
| small  | 100     |
| medium | 10,000  |
| large  | 100,000 |

In addition to row counts, each state also defines a valid ID range. This is necessary for operations such as:

- `GET /todos/:id`
- `PATCH /todos/:id`
- `DELETE /todos/:id`

The request generator uses the configured ID range to dynamically generate valid resource paths.

---

## Experiment Matrix

The file `experiment-matrix.json` defines which scenario/state/concurrency combinations are actually executed.

Current matrix:

- **S1 Read-Only**

  - states: `small`, `medium`, `large`
  - concurrency: `1`, `8`, `32`

- **S2 Write**

  - states: `empty`, `small`
  - concurrency: `1`, `8`, `32`

- **S3 Mixed CRUD**

  - states: `medium`
  - concurrency: `8`, `32`

### Expansion into Experiment Points

This expands to:

- 9 experiment points for `s1-read-only`
- 6 experiment points for `s2-write`
- 2 experiment points for `s3-mixed-crud`

Total:

- **17 experiment points per backend**
- **68 experiment points across 4 backends**

Since each experiment point contains:

- 1 warmup run
- 5 measured runs

the full number of executions is substantial, which makes automated execution essential.

---

## Workload Generation

Requests are generated dynamically at runtime.

The workload system is responsible for:

- selecting operations according to configured weights
- resolving dynamic paths such as `/todos/:id`
- generating request bodies from templates
- producing backend-independent HTTP request definitions for the runner

This design allows the same benchmark logic to be reused across all backends.

---

## Workload Execution and Concurrency Model

### Overview

The benchmark framework separates **workload definition** from **workload execution**.

Scenario files define the structure and composition of the traffic to be generated, while the benchmark runner is responsible for turning those scenario definitions into actual concurrent HTTP requests against the selected backend.

Concurrency in this benchmark refers to the number of simultaneous client connections generated against the target backend. The benchmark runner itself executes experiment points sequentially, but within each experiment point, concurrent HTTP traffic is generated according to the configured concurrency level.

### Execution Flow

For each selected experiment point, the benchmark runner performs the following steps:

1. Load the selected scenario, data state, and concurrency level
2. Reset and seed the corresponding backend database
3. Create a fresh scenario runtime for the run
4. Dynamically generate requests according to the scenario definition
5. Execute a warmup run
6. Execute the measured runs
7. Extract throughput, latency, and error metrics
8. Aggregate the measured results using the median
9. Write the results to the output directory

### Sequential Experiments vs Concurrent Requests

An important distinction in the framework is the difference between:

- **sequential experiment execution**
- **concurrent request execution within one experiment**

The benchmark runner does **not** run multiple experiment points in parallel. Instead, experiment points are executed one after another to avoid interference between runs.

However, within a single experiment point, the load generator sends multiple requests concurrently according to the configured concurrency level.

This means the benchmark follows the model:

**sequential experiment scheduling + concurrent HTTP request execution**

### Concurrency Definition

In this framework, concurrency means:

- the number of simultaneous client connections opened against the backend
- not the number of manually created benchmark worker threads
- not the number of parallel experiment runner processes

For example:

- concurrency `1` represents a minimal baseline load
- concurrency `8` represents light concurrent traffic
- concurrency `32` represents a stronger concurrent workload

The actual internal handling of that incoming concurrency is left to the backend runtime and framework implementation.

The load generator uses `pipelining: 1`, meaning each connection processes requests sequentially without HTTP pipelining. Concurrency is therefore expressed through multiple simultaneous connections rather than multiple in-flight requests on a single connection. This simplifies the load model and improves comparability across backends.

### Scenario Runtime and Request Generation

Scenario execution is configuration-driven.

The process is:

1. Scenario JSON files define the weighted operation mix
2. The configuration loader reads the scenario definitions
3. The scenario runtime creates a request generator for the selected scenario
4. For each outgoing request, the generator:

   - selects an operation according to its configured weight
   - resolves dynamic paths such as `/todos/:id`
   - generates request bodies from templates when needed

As a result, the workload is not a static replay of predefined requests. Instead, requests are generated dynamically throughout the benchmark run.

### Concurrency Handling in the Runner

The benchmark runner itself does not implement custom worker-thread, thread-pool, or multi-process orchestration for benchmark traffic generation.

Its role is to:

- orchestrate benchmark execution
- prepare database state
- generate request definitions
- invoke the load generator
- collect and aggregate metrics

The actual concurrent HTTP traffic is produced by the load generation layer.

This keeps the benchmark runner architecture simple and makes the concurrency model easier to reason about and reproduce.

### Backend-Side Concurrency

While the benchmark generates the same external concurrency model for all backends, each backend handles incoming requests according to its own runtime architecture.

Examples:

- **Express (Node.js)** typically uses an event-loop-based asynchronous model
- **Spring Boot** commonly uses a thread-pool-based request handling model
- **ASP.NET** uses a managed runtime with asynchronous request handling and thread-pool scheduling
- **FastAPI** typically runs on an ASGI-based asynchronous execution model

This is an intentional design decision. The benchmark standardizes the external load conditions, while allowing each backend to respond using its natural framework-specific concurrency model.

### Why This Matters

This design allows the benchmark to measure:

- how throughput changes under increasing concurrent load
- how latency behaves under contention
- whether a backend degrades gracefully at higher concurrency
- whether error rates increase under mixed or heavier workloads

By documenting the concurrency model explicitly, the methodology becomes easier to understand, evaluate, and reproduce.

### Concurrency and Request Workflow Diagram

```text
                         BENCHMARK WORKLOAD EXECUTION FLOW

┌──────────────────────────────┐
│ Configuration Files          │
│------------------------------│
│ benchmark-policy.json        │
│ data-states.json             │
│ experiment-matrix.json       │
│ scenarios/*.json             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ config-loader.js             │
│------------------------------│
│ Loads and validates config   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ matrix-builder.js            │
│------------------------------│
│ Expands matrix into concrete │
│ experiment points            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ index.js                     │
│------------------------------│
│ Main benchmark orchestrator  │
│ Runs experiment points       │
│ sequentially                 │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ experiment-runner.js         │
│------------------------------│
│ Runs one experiment point    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ repetition-runner.js         │
│------------------------------│
│ Warmup + measured runs       │
└───────┬────────────────┬─────┘
        │                │
        ▼                ▼
┌──────────────────┐   ┌──────────────────────────────┐
│ db-preparer.js   │   │ scenario-runtime.js          │
│------------------│   │------------------------------│
│ Reset + seed DB  │   │ Creates runtime request flow │
└────────┬─────────┘   └──────────────┬───────────────┘
         │                            │
         ▼                            ▼
┌──────────────────┐       ┌──────────────────────────┐
│ Shell Scripts    │       │ request-generators.js    │
│------------------│       │--------------------------│
│ reset / seed     │       │ weighted operation pick  │
│ backend-specific │       │ path resolution          │
│ DB preparation   │       │ body template generation │
└──────────────────┘       └──────────────┬───────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │ run-autocannon.js        │
                              │--------------------------│
                              │ sends concurrent HTTP    │
                              │ requests for one run     │
                              └──────────────┬───────────┘
                                             │
                     concurrency = simultaneous client connections
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │ Target Backend Container │
                              │--------------------------│
                              │ Express / Spring Boot /  │
                              │ ASP.NET / FastAPI        │
                              └──────────────┬───────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │ PostgreSQL Database      │
                              └──────────────┬───────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │ metrics.js               │
                              │ aggregate.js             │
                              │ result-writer.js         │
                              └──────────────┬───────────┘
                                             │
                                             ▼
                              ┌──────────────────────────┐
                              │ benchmark/results/...    │
                              └──────────────────────────┘
```

---

## Containerization and Runtime Consistency

All backend implementations are containerized and started through Docker Compose. This provides a consistent execution model across all systems under test.

Containerization is used here to improve methodological consistency by ensuring that:

- each backend is started in the same operational manner
- each backend runs in an isolated service container
- all backends connect to the same shared PostgreSQL service model
- startup, shutdown, and verification can be automated uniformly
- local environment differences are reduced

The benchmark does not rely on manually starting each framework in a different way. Instead, all backends follow the same container-based process, which helps provide a more comparable starting point.

---

## Backend Implementation Example

### Express Backend Example Architecture

```text
┌────────────────────────────┐
│ 1. Startup Layer           │
├────────────────────────────┤
│ server.js                  │
│ - starts application       │
│ - checks DB connectivity   │
│ - handles shutdown         │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 2. Application Setup Layer │
├────────────────────────────┤
│ app.js                     │
│ - builds Express app       │
│ - configures middleware    │
│ - registers routes         │
│ - registers error handling │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 3. Routing Layer           │
├────────────────────────────┤
│ todo-routes.js             │
│ - maps endpoints to        │
│   controller functions     │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 4. Controller Layer        │
├────────────────────────────┤
│ todo-controller.js         │
│ - handles HTTP request     │
│ - calls service functions  │
│ - sends HTTP responses     │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 5. Service Layer           │
├────────────────────────────┤
│ todo-service.js            │
│ - validation               │
│ - business rules           │
│ - AppError handling logic  │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 6. Repository Layer        │
├────────────────────────────┤
│ todo-repository.js         │
│ - SQL statements           │
│ - CRUD access to todos     │
└──────────────┬─────────────┘
               │
               ▼
┌──────────────────────────────┐
│ 7. Database Access Layer     │
├──────────────────────────────┤
│ config/database.js           │
│ - PostgreSQL connection      │
│ - shared query() helper      │
│ - connection pool management │
└──────────────┬───────────────┘
               │
               ▼
┌────────────────────────────┐
│ 8. Database                │
├────────────────────────────┤
│ PostgreSQL                 │
│ - todos table              │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 9. Serialization Layer     │
├────────────────────────────┤
│ todo-serializer.js         │
│ - converts DB rows into    │
│   API response objects     │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ 10. Middleware Layer       │
├────────────────────────────┤
│ error-handler.js           │
│ - handles AppError         │
│ - handles JSON errors      │
│ - handles internal errors  │
│                            │
│ not-found.js               │
│ - handles unknown routes   │
└────────────────────────────┘
```

### Express Backend Workflow

- `server.js` starts the application after verifying database connectivity
- `app.js` configures middleware and registers API routes
- `todo-routes.js` maps HTTP endpoints to controller functions
- `todo-controller.js` handles request/response flow and delegates to the service layer
- `todo-service.js` validates input, applies business rules, and throws `AppError` when needed
- `todo-repository.js` executes SQL queries for CRUD operations on the `todos` table
- `config/database.js` manages the PostgreSQL connection pool and query execution
- `todo-serializer.js` transforms database rows into the public API response format
- `error-handler.js` and `not-found.js` provide centralized error and 404 handling

This example illustrates one concrete backend implementation. The other backends follow the same benchmark methodology and API contract, even though their internal implementation structure differs by framework and language.

---

## Environment Preparation

Before running benchmarks, the test machine should be prepared to reduce external noise and improve result consistency.

### Recommended Preparation Steps

- close unnecessary applications before starting the benchmark
- check **Activity Monitor**, **Task Manager**, or the Linux system monitor equivalent
- quit background applications that may consume CPU, memory, disk I/O, or network resources
- avoid running unrelated development tools, browser sessions, sync clients, media applications, or large downloads during measurement
- ensure Docker is running properly before starting the benchmark
- if possible, allow the benchmark machine to remain otherwise idle during official runs

This is especially important because benchmark results can be influenced by competing system activity outside the benchmark itself.

---

## Command Execution Location

All commands in this project should be executed from the **repository root folder**.

This is important because:

- Docker Compose expects to be run from the project root
- helper scripts resolve paths relative to the repository root
- benchmark execution, database reset/seed scripts, and backend startup scripts rely on the root-level directory structure

Running commands from subfolders may lead to incorrect path resolution or missing-file errors.

All command examples in this README assume that the current working directory is the repository root.

---

## Starting the Environment

Before running benchmarks, start the required services.

### Start PostgreSQL and one backend

Example for Express:

```bash
docker compose up -d postgres express
```

Example for Spring Boot:

```bash
docker compose up -d postgres springboot
```

Example for ASP.NET:

```bash
docker compose up -d postgres aspnet
```

Example for FastAPI:

```bash
docker compose up -d postgres fastapi
```

The repository also provides helper scripts for starting, stopping, resetting, seeding, and verifying each backend.

---

## Running the Benchmark

The benchmark runner should be started from the **repository root directory**.

### Basic Command

```bash
node benchmark/runner/src/index.js --category validation --backend express
```

### Parameters

| Flag            | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| `--backend`     | Target backend (`express`, `springboot`, `aspnet`, `fastapi`) |
| `--category`    | Result category (`validation` or `official`)                  |
| `--scenario`    | Optional filter by scenario                                   |
| `--state`       | Optional filter by data state                                 |
| `--concurrency` | Optional filter by concurrency                                |

### Example

Run the read-only scenario on the medium dataset with concurrency 8 for the Express backend:

```bash
node benchmark/runner/src/index.js \
  --category validation \
  --backend express \
  --scenario s1-read-only \
  --state medium \
  --concurrency 8
```

---

## Running Helper Scripts

Helper scripts should also be executed from the **repository root directory**.

Examples:

```bash
./scripts/express/start-express-backend.sh
./scripts/express/reset-and-seed-express-db-state.sh small
./scripts/express/verify-express-cycle.sh
```

Equivalent scripts are available for the other backends as well.

In addition to backend lifecycle and database helper scripts, the repository also contains dedicated **API parity verification scripts** for comparing ASP.NET, FastAPI, and Spring Boot against the Express reference implementation. These are described in the next section.

---

## API Parity Verification

Before performance benchmarking, the backend implementations are checked for strict API parity.

Express serves as the reference implementation for API parity verification. The other backends are validated against Express rather than through all pairwise backend-to-backend comparisons. Once each backend matches the same reference behavior, they are treated as functionally equivalent for the subsequent performance benchmark.

The purpose of these parity checks is to ensure that all benchmarked systems expose equivalent externally visible behavior. This is important because performance results are only meaningful when the compared systems implement the same contract and handle edge cases consistently.

### Reference Backend

The **Express backend** is used as the reference implementation.

The other backends are compared against Express:

- ASP.NET
- FastAPI
- Spring Boot

### What the Parity Scripts Check

The parity scripts compare the following aspects of API behavior:

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

Examples of tested cases include:

- `GET /todos`
- `GET /todos/:id`
- `GET /todos/abc`
- `GET` unknown route
- valid `POST /todos`
- malformed JSON in `POST`
- invalid field types in `POST`
- `PATCH` with `order: null`
- `PATCH` with unknown fields
- `PATCH` with invalid IDs
- `DELETE /todos/:id`
- `DELETE /todos`
- `GET /todos` after delete-all

### Deterministic Test Setup

Each parity script performs the following steps:

1. verify that both compared backends are reachable
2. reset both databases into a clean state
3. seed deterministic initial todo rows
4. capture the created IDs dynamically
5. run the same logical HTTP test cases against both backends
6. normalize backend-specific response differences that are not semantically relevant
7. compare status codes, headers, and bodies

This makes the parity process reproducible and suitable for repeated validation during development.

### Normalization Rules

The parity scripts normalize certain transport-level differences so that comparisons focus on API semantics rather than framework-specific HTTP formatting.

Examples include:

- comparison of **numeric HTTP status codes** instead of full reason phrases
- removal of unstable transport headers such as `Date`, `Content-Length`, and `Transfer-Encoding`
- normalization of JSON content type variants such as `application/json; charset=utf-8`
- replacement of backend-specific base URLs in response bodies with a placeholder value

These normalizations are intentional and methodology-driven. They do not weaken the comparison; they prevent false mismatches caused by framework-level HTTP formatting differences that are not part of the benchmarked API contract.

### Available Parity Scripts

The repository includes the following comparison scripts:

```bash
./scripts/compare-express-aspnet-parity.sh
./scripts/compare-express-fastapi-parity.sh
./scripts/compare-express-springboot-parity.sh
```

### Running the Parity Checks

All commands should be run from the repository root.

Example: Express vs ASP.NET

```bash
docker compose up -d postgres express aspnet
./scripts/compare-express-aspnet-parity.sh
```

Example: Express vs FastAPI

```bash
docker compose up -d postgres express fastapi
./scripts/compare-express-fastapi-parity.sh
```

Example: Express vs Spring Boot

```bash
docker compose up -d postgres express springboot
./scripts/compare-express-springboot-parity.sh
```

### Interpreting the Output

For each test case, the scripts report:

- `Status: MATCH`
- `Headers: MATCH`
- `Body: MATCH`

A backend is considered parity-aligned with the Express reference implementation when all tested cases match under the defined normalization rules.

### Role in the Overall Methodology

The parity scripts are part of the benchmark validation workflow.

They are used to confirm that:

- backend implementations remain contract-equivalent during development
- performance comparisons are not distorted by API behavior differences
- bug fixes and refactorings do not silently introduce behavioral drift

In this way, parity checking supports the fairness, reproducibility, and methodological transparency of the benchmark framework.

---

## Results

Each benchmark run produces a timestamped results directory:

```text
benchmark/results/<category>/<backend>/<timestamp>/
```

The following files are written:

- `raw-results.json`
  Full detailed results, including warmup and measured run data

- `summary.csv`
  Compact summary of the aggregated metrics

- `run-metadata.json`
  Metadata about the benchmark run, including filters, target backend, and execution timing

---

## Key Design Decisions

### Separation of Configuration and Execution

All benchmark parameters are externalized into JSON files. This improves:

- reproducibility
- transparency
- extensibility

### Median Aggregation

Median is used instead of arithmetic mean to reduce the influence of outliers and short-lived measurement noise.

### Database Reset Before Each Run

Each warmup and measured run starts from a defined database state. This ensures consistent and comparable starting conditions.

### Weighted Scenario Definitions

Operation weights allow realistic and reusable workload descriptions while keeping the scenario format simple.

### Shared Methodology Across Backends

All backends implement the same API contract and are executed under the same benchmark policy, which supports fairer comparison.

### Containerized Backend Execution

All backends are executed as containers, providing a uniform runtime model and reducing differences in manual startup procedures.

---

## Limitations

While the benchmark framework is designed to provide fair and reproducible comparisons, several limitations should be noted:

- Results are influenced by the underlying hardware and local execution environment
- Containerization improves consistency but does not eliminate all runtime differences
- Framework-specific optimizations and runtime characteristics remain part of what is being measured
- Network stack behavior and operating system scheduling may introduce variability under high load

These factors should be considered when interpreting benchmark results.

---

## Summary

This project provides a configurable and reproducible benchmarking framework for RESTful backend systems. By combining structured workload definitions, controlled database states, repeated measurement, consistent result aggregation, and containerized backend execution, it supports meaningful performance analysis across multiple backend technologies.

The benchmark framework is designed not only to produce results, but also to make the methodology itself transparent, explainable, and extensible.
