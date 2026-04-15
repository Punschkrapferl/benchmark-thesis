-- Development-only convenience seed for quick local checks.
-- Do not use this file for official benchmark preparation.

INSERT INTO todos (title, completed, "order")
VALUES
  ('Write benchmark plan', false, 1),
  ('Implement Express backend', true, 2),
  ('Prepare PostgreSQL reset script', false, 3);