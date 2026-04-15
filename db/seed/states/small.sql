-- Official benchmark seed state: small
-- Expected row count after reset + seed: 100
--
-- Purpose:
-- Provides a lightweight populated baseline.
-- Useful for quick validation, read-heavy checks, and light write comparisons.

INSERT INTO todos (title, completed, "order")
SELECT
  'Todo ' || LPAD(gs::text, 6, '0') AS title,
  CASE WHEN gs % 2 = 0 THEN TRUE ELSE FALSE END AS completed,
  gs AS "order"
FROM generate_series(1, 100) AS gs;