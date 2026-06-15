CREATE TABLE IF NOT EXISTS core.messaging_sync_states (
  client_id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'FLW',
  last_session_sync_at timestamptz NULL,
  last_message_sync_at timestamptz NULL,
  last_success_at timestamptz NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
