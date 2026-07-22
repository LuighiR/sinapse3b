CREATE INDEX IF NOT EXISTS call_facts_client_status_started_idx
  ON core.call_facts (client_id, status, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_direction_started_idx
  ON core.call_facts (client_id, direction, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_started_at_id_idx
  ON core.call_facts (client_id, started_at, id);

-- Reclassify answered queue-only calls (3-digit destination, no extension_uuid)
-- as unanswered and without agent attribution. Idempotent.
UPDATE core.call_facts
SET
  is_received = false,
  is_lost = true,
  agent_resolution_type = NULL,
  agent_resolution_key = NULL,
  updated_at = NOW()
WHERE is_inbound_to_company = true
  AND COALESCE(status, '') = 'answered'
  AND NULLIF(extension_uuid, '') IS NULL
  AND COALESCE(destination_number, '') ~ '^\d{3}$'
  AND (
    is_received = true
    OR is_lost = false
    OR agent_resolution_type IS NOT NULL
    OR agent_resolution_key IS NOT NULL
  );
