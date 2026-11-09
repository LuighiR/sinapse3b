CREATE INDEX IF NOT EXISTS budget_facts_client_closing_date_idx
  ON core.budget_facts (client_id, closing_date);

CREATE INDEX IF NOT EXISTS budget_facts_client_cancellation_date_idx
  ON core.budget_facts (client_id, cancellation_date);
