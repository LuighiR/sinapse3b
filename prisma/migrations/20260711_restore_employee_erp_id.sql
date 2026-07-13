-- Restore employees.erp_id from employee_erp_users, then drop the link table.

ALTER TABLE core.employees
ADD COLUMN IF NOT EXISTS erp_id BIGINT;

DO $$
DECLARE
  multi_report TEXT;
  missing_report TEXT;
BEGIN
  SELECT string_agg(
    format('employee_id=%s erp_ids=%s', employee_id, erp_ids),
    E'\n'
  )
  INTO multi_report
  FROM (
    SELECT
      employee_id,
      string_agg(erp_id::text, ',' ORDER BY erp_id) AS erp_ids
    FROM core.employee_erp_users
    GROUP BY employee_id
    HAVING COUNT(*) > 1
  ) dups;

  IF multi_report IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot restore employees.erp_id: employee has multiple erp users:%s%s', E'\n', multi_report;
  END IF;

  SELECT string_agg(e.id::text, ',' ORDER BY e.id)
  INTO missing_report
  FROM core.employees e
  LEFT JOIN core.employee_erp_users eu ON eu.employee_id = e.id
  WHERE eu.id IS NULL;

  IF missing_report IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot restore employees.erp_id: employees without erp users: %', missing_report;
  END IF;
END $$;

UPDATE core.employees AS e
SET erp_id = eu.erp_id
FROM core.employee_erp_users AS eu
WHERE eu.employee_id = e.id;

ALTER TABLE core.employees
ALTER COLUMN erp_id SET NOT NULL;

DROP TABLE IF EXISTS core.employee_erp_users;
