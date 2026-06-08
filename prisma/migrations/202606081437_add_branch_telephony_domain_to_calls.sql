ALTER TABLE core.branches
ADD COLUMN IF NOT EXISTS telephony_domain_uuid text;

CREATE UNIQUE INDEX IF NOT EXISTS branches_telephony_domain_uuid_key
ON core.branches(telephony_domain_uuid)
WHERE telephony_domain_uuid IS NOT NULL;

ALTER TABLE core.call_facts
ADD COLUMN IF NOT EXISTS branch_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'call_facts_branch_id_fkey'
      AND conrelid = 'core.call_facts'::regclass
  ) THEN
    ALTER TABLE core.call_facts
    ADD CONSTRAINT call_facts_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS call_facts_client_branch_started_at_idx
ON core.call_facts(client_id, branch_id, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_branch_inbound_started_idx
ON core.call_facts(client_id, branch_id, is_inbound_to_company, started_at);
