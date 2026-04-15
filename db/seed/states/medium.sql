-- Official benchmark seed state: medium
-- Expected row count after reset + seed: 10000
--
-- Purpose:
-- Represents a normal benchmark working set.
-- Large enough to be meaningful while still practical for repeated runs.

INSERT INTO todos (title, completed, "order")
SELECT
  'Todo ' || LPAD(gs::text, 6, '0') AS title,
  CASE WHEN gs % 2 = 0 THEN TRUE ELSE FALSE END AS completed,
  gs AS "order"
FROM generate_series(1, 10000) AS gs;