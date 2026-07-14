DO $$
BEGIN
  CREATE TYPE core.whatsapp_department_mapping_status AS ENUM ('PENDING', 'MAPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS core.whatsapp_cities (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE core.whatsapp_cities
    ADD CONSTRAINT whatsapp_cities_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_cities_client_name_key
  ON core.whatsapp_cities (client_id, name);

CREATE TABLE IF NOT EXISTS core.whatsapp_department_mappings (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  department_id uuid NOT NULL,
  department_label text NULL,
  city_id uuid NULL,
  status core.whatsapp_department_mapping_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE core.whatsapp_department_mappings
    ADD CONSTRAINT whatsapp_department_mappings_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE core.whatsapp_department_mappings
    ADD CONSTRAINT whatsapp_department_mappings_city_id_fkey
      FOREIGN KEY (city_id) REFERENCES core.whatsapp_cities(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_department_mappings_client_department_key
  ON core.whatsapp_department_mappings (client_id, department_id);

CREATE INDEX IF NOT EXISTS whatsapp_department_mappings_client_status_idx
  ON core.whatsapp_department_mappings (client_id, status);

ALTER TABLE core.messaging_sessions
  ADD COLUMN IF NOT EXISTS whatsapp_city_id uuid NULL;

ALTER TABLE core.messaging_sessions
  ADD COLUMN IF NOT EXISTS external_department_id uuid NULL;

DO $$
BEGIN
  ALTER TABLE core.messaging_sessions
    ADD CONSTRAINT messaging_sessions_whatsapp_city_id_fkey
      FOREIGN KEY (whatsapp_city_id) REFERENCES core.whatsapp_cities(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS messaging_sessions_client_whatsapp_city_started_at_idx
  ON core.messaging_sessions (client_id, whatsapp_city_id, started_at);

CREATE INDEX IF NOT EXISTS messaging_sessions_client_external_department_idx
  ON core.messaging_sessions (client_id, external_department_id);
