-- 1) Create table
CREATE TABLE core.employee_erp_users (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id TEXT NOT NULL REFERENCES core.sinapse_clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  erp_id BIGINT NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES core.branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_erp_users_client_erp_id_key UNIQUE (client_id, erp_id)
);

CREATE INDEX employee_erp_users_employee_id_idx ON core.employee_erp_users (employee_id);
CREATE INDEX employee_erp_users_branch_id_idx ON core.employee_erp_users (branch_id);
CREATE INDEX employee_erp_users_erp_id_branch_id_idx ON core.employee_erp_users (erp_id, branch_id);

-- 2) Fail on duplicate erp_id within the same client
DO $$
DECLARE
  dup_report TEXT;
BEGIN
  SELECT string_agg(
    format('client=%s erp_id=%s employees=%s', client_id, erp_id, employee_ids),
    E'\n'
  )
  INTO dup_report
  FROM (
    SELECT
      b.client_id,
      e.erp_id,
      string_agg(e.id::text, ',' ORDER BY e.id) AS employee_ids
    FROM core.employees e
    JOIN core.branches b ON b.id = e.branch_id
    GROUP BY b.client_id, e.erp_id
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_report IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot migrate employees.erp_id: duplicate erp_id within client:%s%s', E'\n', dup_report;
  END IF;
END $$;

-- 3) Backfill
INSERT INTO core.employee_erp_users (employee_id, client_id, erp_id, branch_id)
SELECT e.id, b.client_id, e.erp_id, e.branch_id
FROM core.employees e
JOIN core.branches b ON b.id = e.branch_id;

-- 4) Drop old column
ALTER TABLE core.employees DROP COLUMN erp_id;
