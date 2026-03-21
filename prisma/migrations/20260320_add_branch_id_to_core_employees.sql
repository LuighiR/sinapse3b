ALTER TABLE core.employees
ADD COLUMN IF NOT EXISTS branch_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_branch_id_fkey'
      AND conrelid = 'core.employees'::regclass
  ) THEN
    ALTER TABLE core.employees
    ADD CONSTRAINT employees_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employees_branch_id_idx
ON core.employees(branch_id);
