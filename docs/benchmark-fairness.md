# Benchmark fairness configuration

This document records runtime settings that must stay aligned across backends so
performance comparisons measure equivalent work, not accidental configuration drift.

Express is the reference implementation. Other backends should match these values
where they influence throughput, latency, or database load.

## Database

| Setting | Value | Notes |
| ------- | ----- | ----- |
| Engine | PostgreSQL 15.17 | Shared `postgres` service |
| Schema | `db/init/010_create_todos_schema_table.sql` | One database per backend |
| Seed states | `db/seed/states/*.sql` | empty / small / medium / large |
| Reset | `TRUNCATE TABLE todos RESTART IDENTITY` | Before each benchmark run when policy requires it |

## CPU budget (production-style)

Benchmarks run on one machine at a time (one backend under test + shared Postgres + k6).
Docker CPU limits keep the load generator from starving:

| Component | CPU limit | Notes |
| --------- | --------- | ----- |
| Backend under test | 4 | express / springboot / aspnet / fastapi |
| PostgreSQL | 2 | shared `postgres` service |
| k6 (Docker) | 2 | `docker run --cpus 2` in the benchmark runner |

Host apps (browser, IDE, other macOS users) are outside this budget. Close heavy
host processes before long runs to reduce swap noise.

## Process / worker model

| Backend | Deployment shape | Where configured |
| ------- | ------------------ | ---------------- |
| Express | Node `cluster`, 4 workers | `WEB_CONCURRENCY=4`, `src/cluster.js`, `npm start` |
| FastAPI | uvicorn, 4 workers + async psycopg | `--workers 4` in Dockerfile; async pool in `app/db.py` |
| Spring Boot | JVM + embedded Tomcat (multi-threaded) | single process, `cpus: 4` |
| ASP.NET | Kestrel (multi-threaded) | single process, `cpus: 4` |

## Connection pools (total = 20 per backend)

Multi-process backends use **5 connections per worker × 4 workers = 20 total**.
Single-process backends use **20 connections in one pool**.

| Backend | Per-process max | Processes | Total |
| ------- | --------------- | --------- | ----- |
| Express | 5 (`DB_POOL_MAX`) | 4 workers | 20 |
| FastAPI | 5 (`DB_POOL_MAX_SIZE`) | 4 workers | 20 |
| Spring Boot | 20 (Hikari) | 1 JVM | 20 |
| ASP.NET | 20 (connection string) | 1 process | 20 |

## GET /todos pagination (benchmark workload)

Official read scenarios use **keyset pagination**: `GET /todos?limit=100&afterId=…`,
translated to `WHERE id > :afterId ORDER BY id ASC LIMIT :limit`. All backends must:

- Return the full table when **no** `limit` or `afterId` query param is present.
- Apply keyset pagination when **either** param is present.
- Default invalid `limit` to **100**, cap valid `limit` at **500**.
- Default invalid `afterId` to **0**.

Keyset pagination keeps page cost O(log n) regardless of table depth so the data-state
axis does not measure PostgreSQL offset-scan cost.

Parity scripts verify this contract against Express (via published host ports).

## Production-like runtime

| Backend | Setting |
| ------- | ------- |
| Express | `NODE_ENV=production` |
| ASP.NET | `ASPNETCORE_ENVIRONMENT=Production` |
| Spring Boot | Production runtime settings (tuned Hikari pool, no dev tooling) |
| FastAPI | No dev docs (`docs_url=None`) |

## Load generator

| Setting | Value | Notes |
| ------- | ----- | ----- |
| Tool | k6 in Docker | Image `grafana/k6:2.0.0` (override with `K6_DOCKER_IMAGE`) |
| Network | `benchmark-net` | Container-to-container; avoids Docker Desktop host proxy latency |
| Workload script | `benchmark/runner/k6/workload.js` | Mounted into the k6 container per run |
| Target URL | `http://<service>:<port>` | e.g. `http://springboot:8080` |
| Request timeout | `requestTimeoutSeconds` (policy) | Explicit per-request timeout so stalled requests count as failures instead of hanging |

The Node runner spawns `docker run` on each warmup/measured repetition. Parity and
manual API checks still use `http://127.0.0.1:<port>` via published compose ports.

## Load models

Each matrix entry declares a `loadModel`. The numeric axis it sweeps and the k6
executor depend on it.

| Load model | k6 executor | Numeric axis | Measures |
| ---------- | ----------- | ------------ | -------- |
| `closed` | `constant-vus` | `concurrency` = virtual users (connections) | Throughput plateau and latency growth. Self-throttling: clients wait for each response, so the backend can never be overloaded. |
| `open` | `constant-arrival-rate` | `arrivalRates` = target requests/second (`maxVus` caps in-flight requests) | Breaking point. The offered rate is injected regardless of whether the backend keeps up. |

**Why both.** A closed model answers "how fast can it go and how does latency grow"
but cannot crash the backend, so its `error_rate` stays ~0 by construction. Each closed
scenario has a matching open overload probe with the **same operation weights**:

| Closed (plateau) | Open (breaking point) |
| ---------------- | --------------------- |
| `s1-read-only-paged` | `s4-overload` |
| `s2-write` | `s5-overload-write` |
| `s3-mixed-crud` | `s6-overload-mixed-crud` |

Open scenarios answer "how many requests per second until it breaks":

- `error_rate` (max across reps) rises when requests time out or return non-2xx/3xx.
- `dropped_iteration_rate` (max across reps) rises when k6 runs out of `maxVus` and
  can no longer deliver the offered rate — generator-side load shedding.

## Metric aggregation

Performance metrics (`throughput`, `latency_*`) are aggregated across repetitions
with the **median** (robust to outliers). Failure metrics (`error_rate`,
`dropped_iteration_rate`) are aggregated with the **maximum** on purpose: a single
repetition where the backend failed is the breaking-point signal and must not be
discarded. Per-repetition values are kept in `raw-results.json`.

## What parity scripts verify

1. **HTTP contract** — status codes, headers, JSON bodies, validation messages.
2. **Pagination semantics** — bounded reads for benchmark paths (after `small` seed).
3. **Not verified via HTTP** — CPU limits, worker counts (this document + `docker-compose.yml`).
