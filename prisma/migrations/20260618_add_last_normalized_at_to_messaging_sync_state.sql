ALTER TABLE core.messaging_sync_states
  ADD COLUMN IF NOT EXISTS last_normalized_at timestamptz NULL;
