ALTER TABLE core.budget_facts
ADD COLUMN IF NOT EXISTS cancellation_date date NULL,
ADD COLUMN IF NOT EXISTS cancelation_time text NULL;
