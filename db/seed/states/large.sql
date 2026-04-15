-- Official benchmark seed state: large
-- Expected row count after reset + seed: 100000
--
-- Purpose:
-- Represents a substantially larger persisted state.
-- Useful for observing how dataset size influences throughput, latency,
-- and degradation under heavier read or mixed workloads.

INSERT INTO todos (title, completed, "order")
SELECT
  'Todo ' || LPAD(gs::text, 6, '0') AS title,
  CASE WHEN gs % 2 = 0 THEN TRUE ELSE FALSE END AS completed,
  gs AS "order"
FROM generate_series(1, 100000) AS gs;