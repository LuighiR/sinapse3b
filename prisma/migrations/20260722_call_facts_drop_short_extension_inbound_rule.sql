-- Expand is_inbound_to_company to all direction=inbound rows.
-- Drops the previous 2-5 digit destination / internal-caller short-extension gate.
-- Recalculates received/lost and agent attribution for newly included rows. Idempotent.

UPDATE core.call_facts
SET
  is_inbound_to_company = true,
  is_received = CASE
    WHEN COALESCE(status, '') = 'answered'
      AND NOT (
        NULLIF(extension_uuid, '') IS NULL
        AND COALESCE(destination_number, '') ~ '^\d{3}$'
      )
    THEN true
    ELSE false
  END,
  is_lost = CASE
    WHEN COALESCE(status, '') IN ('missed', 'no_answer', 'no_answered') THEN true
    WHEN COALESCE(status, '') = 'answered'
      AND NULLIF(extension_uuid, '') IS NULL
      AND COALESCE(destination_number, '') ~ '^\d{3}$'
    THEN true
    ELSE false
  END,
  agent_resolution_type = CASE
    WHEN NULLIF(extension_uuid, '') IS NOT NULL THEN 'EXTENSION_UUID'
    WHEN COALESCE(status, '') IN ('missed', 'no_answer', 'no_answered')
      AND NULLIF(destination_number, '') IS NOT NULL
    THEN 'EXTENSION_NUMBER'
    ELSE NULL
  END,
  agent_resolution_key = CASE
    WHEN NULLIF(extension_uuid, '') IS NOT NULL THEN extension_uuid
    WHEN COALESCE(status, '') IN ('missed', 'no_answer', 'no_answered')
      AND NULLIF(destination_number, '') IS NOT NULL
    THEN destination_number
    ELSE NULL
  END,
  agent_extension_number = destination_number,
  updated_at = NOW()
WHERE direction = 'inbound'
  AND is_inbound_to_company = false;
