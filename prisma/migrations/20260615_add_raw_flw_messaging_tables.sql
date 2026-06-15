CREATE TABLE IF NOT EXISTS raw.flw_sessions (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  payload_json jsonb NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flw_sessions_client_fetched_at_idx
  ON raw.flw_sessions (client_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS raw.flw_messages (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  session_id uuid NOT NULL,
  payload_json jsonb NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flw_messages_client_session_fetched_at_idx
  ON raw.flw_messages (client_id, session_id, fetched_at DESC);
