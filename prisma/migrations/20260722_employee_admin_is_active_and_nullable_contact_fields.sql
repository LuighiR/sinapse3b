-- Soft-delete flag and optional contact/extension fields for employee admin API.

ALTER TABLE core.employees
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE core.employees
ALTER COLUMN extension_number DROP NOT NULL,
ALTER COLUMN extension_uuid DROP NOT NULL,
ALTER COLUMN chat_id DROP NOT NULL;

UPDATE core.employees
SET extension_number = NULL
WHERE extension_number IS NOT NULL AND btrim(extension_number) = '';

UPDATE core.employees
SET extension_uuid = NULL
WHERE extension_uuid IS NOT NULL AND btrim(extension_uuid) = '';

UPDATE core.employees
SET chat_id = NULL
WHERE chat_id IS NOT NULL AND btrim(chat_id) = '';

-- Keep one row per non-null contact identifier so unique indexes can be created.
UPDATE core.employees AS duplicate
SET extension_uuid = NULL
FROM core.employees AS keeper
WHERE duplicate.extension_uuid IS NOT NULL
  AND keeper.extension_uuid = duplicate.extension_uuid
  AND keeper.id < duplicate.id;

UPDATE core.employees AS duplicate
SET chat_id = NULL
FROM core.employees AS keeper
WHERE duplicate.chat_id IS NOT NULL
  AND keeper.chat_id = duplicate.chat_id
  AND keeper.id < duplicate.id;

CREATE INDEX IF NOT EXISTS employees_erp_id_idx ON core.employees (erp_id);

-- Uniqueness for non-null contact identifiers (service also scopes by client via branch.client_id).
CREATE UNIQUE INDEX IF NOT EXISTS employees_extension_uuid_key
  ON core.employees (extension_uuid)
  WHERE extension_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_chat_id_key
  ON core.employees (chat_id)
  WHERE chat_id IS NOT NULL;
