CREATE TYPE core.messaging_provider AS ENUM ('FLW', 'DKW');

CREATE TYPE core.messaging_direction AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TYPE core.messaging_sender_type AS ENUM ('HUMAN', 'SYSTEM', 'AI', 'BOT');

CREATE TABLE IF NOT EXISTS core.messaging_sessions (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  branch_id integer NULL,
  provider core.messaging_provider NOT NULL,
  external_session_id text NOT NULL,
  contact_external_id text NULL,
  assigned_agent_email text NULL,
  assigned_agent_user_id text NULL,
  status text NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  raw_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT messaging_sessions_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_sessions_client_provider_external_key
  ON core.messaging_sessions (client_id, provider, external_session_id);

CREATE INDEX IF NOT EXISTS messaging_sessions_client_started_at_idx
  ON core.messaging_sessions (client_id, started_at);

CREATE INDEX IF NOT EXISTS messaging_sessions_client_branch_started_at_idx
  ON core.messaging_sessions (client_id, branch_id, started_at);

CREATE TABLE IF NOT EXISTS core.messaging_messages (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  session_id text NOT NULL,
  provider core.messaging_provider NOT NULL,
  external_message_id text NOT NULL,
  direction core.messaging_direction NOT NULL,
  sender_type core.messaging_sender_type NOT NULL,
  message_type text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  media_url text NULL,
  media_type text NULL,
  created_at_external timestamptz NOT NULL,
  updated_at_external timestamptz NOT NULL,
  raw_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT messaging_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES core.messaging_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_messages_client_provider_external_key
  ON core.messaging_messages (client_id, provider, external_message_id);

CREATE INDEX IF NOT EXISTS messaging_messages_session_created_at_external_idx
  ON core.messaging_messages (session_id, created_at_external);

CREATE INDEX IF NOT EXISTS messaging_messages_client_created_at_external_idx
  ON core.messaging_messages (client_id, created_at_external);
