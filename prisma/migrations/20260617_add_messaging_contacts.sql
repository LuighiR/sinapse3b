CREATE TABLE IF NOT EXISTS core.messaging_contacts (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  provider core.messaging_provider NOT NULL,
  external_contact_id text NOT NULL,
  display_name text NULL,
  phone_normalized text NULL,
  legacy_contact_id bigint NULL,
  raw_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT messaging_contacts_legacy_contact_fkey
    FOREIGN KEY (client_id, legacy_contact_id) REFERENCES core.contacts(client_id, id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_contacts_client_provider_external_key
  ON core.messaging_contacts (client_id, provider, external_contact_id);

CREATE INDEX IF NOT EXISTS messaging_contacts_client_legacy_contact_id_idx
  ON core.messaging_contacts (client_id, legacy_contact_id);

ALTER TABLE core.messaging_sessions
  ADD COLUMN IF NOT EXISTS contact_id text NULL;

DO $$
BEGIN
  ALTER TABLE core.messaging_sessions
    ADD CONSTRAINT messaging_sessions_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES core.messaging_contacts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS messaging_sessions_contact_id_idx
  ON core.messaging_sessions (contact_id);
