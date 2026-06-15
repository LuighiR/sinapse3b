ALTER TABLE core.branches
  ADD COLUMN IF NOT EXISTS flw_department_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS branches_flw_department_id_key
  ON core.branches (flw_department_id)
  WHERE flw_department_id IS NOT NULL;
