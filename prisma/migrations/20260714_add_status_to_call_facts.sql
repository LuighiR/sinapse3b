ALTER TABLE core.call_facts
ADD COLUMN IF NOT EXISTS status text;
