ALTER TABLE raw.ferraco_budgets
ADD COLUMN IF NOT EXISTS client_id text;

CREATE INDEX IF NOT EXISTS ferraco_budgets_client_id_idx
ON raw.ferraco_budgets(client_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ferraco_budgets_client_id_fkey'
      AND conrelid = 'raw.ferraco_budgets'::regclass
  ) THEN
    ALTER TABLE raw.ferraco_budgets
    ADD CONSTRAINT ferraco_budgets_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  preferred_client_id constant text := 'ferracosul';
  preferred_client_slug constant text := 'ferracosul';
  preferred_client_name constant text := 'Ferracosul';
  resolved_client_id text;
BEGIN
  -- Stable seed values for the first operational client.
  SELECT id
  INTO resolved_client_id
  FROM core.sinapse_clients
  WHERE id = preferred_client_id
  LIMIT 1;

  IF resolved_client_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM core.sinapse_clients
      WHERE slug = preferred_client_slug
         OR name = preferred_client_name
    ) THEN
      RAISE EXCEPTION
        'Ferracosul client already exists with an unexpected id. Expected id "%", but found a different row. Resolve manually before rerunning this migration.',
        preferred_client_id;
    END IF;

    INSERT INTO core.sinapse_clients (
      id,
      slug,
      name,
      domain_uuid,
      api_base_url,
      api_key,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      preferred_client_id,
      preferred_client_slug,
      preferred_client_name,
      preferred_client_id,
      '',
      '',
      TRUE,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        domain_uuid = EXCLUDED.domain_uuid,
        api_base_url = EXCLUDED.api_base_url,
        api_key = EXCLUDED.api_key,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    RETURNING id INTO resolved_client_id;
  ELSE
    UPDATE core.sinapse_clients
    SET slug = preferred_client_slug,
        name = preferred_client_name,
        domain_uuid = preferred_client_id,
        is_active = TRUE,
        updated_at = NOW()
    WHERE id = resolved_client_id;
  END IF;

  UPDATE raw.ferraco_budgets
  SET client_id = resolved_client_id
  WHERE client_id IS NULL;
END $$;

CREATE TABLE IF NOT EXISTS core.budget_facts (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  source_table text NOT NULL,
  source_record_id integer NOT NULL,
  branch_name text NOT NULL,
  branch_id integer,
  seller_id integer NOT NULL,
  seller_name text NOT NULL,
  budget_date date NOT NULL,
  budget_datetime timestamp without time zone NOT NULL,
  closing_date date,
  status_raw text,
  status_normalized text NOT NULL DEFAULT 'UNKNOWN',
  channel text,
  customer_name text NOT NULL,
  cpf_cnpj text,
  value_amount numeric(19, 4) NOT NULL,
  sequential bigint,
  dav_id bigint NOT NULL,
  sequential_linked_sale bigint,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_facts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT budget_facts_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS budget_facts_client_source_record_key
ON core.budget_facts(client_id, source_table, source_record_id);

CREATE INDEX IF NOT EXISTS budget_facts_client_budget_date_idx
ON core.budget_facts(client_id, budget_date);

CREATE INDEX IF NOT EXISTS budget_facts_client_seller_budget_date_idx
ON core.budget_facts(client_id, seller_id, budget_date);

CREATE INDEX IF NOT EXISTS budget_facts_client_branch_budget_date_idx
ON core.budget_facts(client_id, branch_id, budget_date);

CREATE SCHEMA IF NOT EXISTS kpi;

CREATE TABLE IF NOT EXISTS kpi.definitions (
  id bigserial PRIMARY KEY,
  code text NOT NULL,
  family text NOT NULL,
  granularity text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS definitions_code_key
ON kpi.definitions(code);

CREATE TABLE IF NOT EXISTS kpi.availability (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  definition_id bigint NOT NULL,
  is_enabled boolean NOT NULL DEFAULT TRUE,
  available_at timestamp without time zone,
  metadata_json jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT availability_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT availability_definition_id_fkey
    FOREIGN KEY (definition_id) REFERENCES kpi.definitions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_client_definition_key
ON kpi.availability(client_id, definition_id);

CREATE INDEX IF NOT EXISTS availability_client_enabled_idx
ON kpi.availability(client_id, is_enabled);

CREATE TABLE IF NOT EXISTS kpi.snapshots (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  definition_id bigint NOT NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric(19, 4) NOT NULL,
  dimensions_json jsonb,
  calculated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT snapshots_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT snapshots_definition_id_fkey
    FOREIGN KEY (definition_id) REFERENCES kpi.definitions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS snapshots_period_metric_key
ON kpi.snapshots(client_id, definition_id, period_type, period_start, period_end, metric_key);

CREATE INDEX IF NOT EXISTS snapshots_client_definition_period_idx
ON kpi.snapshots(client_id, definition_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS kpi.breakdowns (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  definition_id bigint NOT NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  bucket_date date,
  dimension_type text NOT NULL,
  dimension_key text,
  dimension_label text,
  metric_key text NOT NULL,
  metric_value numeric(19, 4) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  payload_json jsonb,
  calculated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT breakdowns_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT breakdowns_definition_id_fkey
    FOREIGN KEY (definition_id) REFERENCES kpi.definitions(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS breakdowns_client_definition_period_idx
ON kpi.breakdowns(client_id, definition_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS breakdowns_client_dimension_bucket_idx
ON kpi.breakdowns(client_id, dimension_type, bucket_date);

CREATE TABLE IF NOT EXISTS kpi.calculation_runs (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  definition_id bigint,
  run_key text NOT NULL,
  status text NOT NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  records_read integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  started_at timestamp without time zone NOT NULL DEFAULT NOW(),
  finished_at timestamp without time zone,
  error_message text,
  metadata_json jsonb,
  CONSTRAINT calculation_runs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT calculation_runs_definition_id_fkey
    FOREIGN KEY (definition_id) REFERENCES kpi.definitions(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS calculation_runs_client_run_key
ON kpi.calculation_runs(client_id, run_key);

CREATE INDEX IF NOT EXISTS calculation_runs_client_started_idx
ON kpi.calculation_runs(client_id, started_at);

CREATE TABLE IF NOT EXISTS kpi.drilldown_refs (
  id bigserial PRIMARY KEY,
  calculation_run_id bigint,
  snapshot_id bigint,
  breakdown_id bigint,
  budget_fact_id bigint,
  ref_type text NOT NULL,
  ref_key text,
  ref_value text,
  payload_json jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT drilldown_refs_calculation_run_id_fkey
    FOREIGN KEY (calculation_run_id) REFERENCES kpi.calculation_runs(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT drilldown_refs_snapshot_id_fkey
    FOREIGN KEY (snapshot_id) REFERENCES kpi.snapshots(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT drilldown_refs_breakdown_id_fkey
    FOREIGN KEY (breakdown_id) REFERENCES kpi.breakdowns(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT drilldown_refs_budget_fact_id_fkey
    FOREIGN KEY (budget_fact_id) REFERENCES core.budget_facts(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS drilldown_refs_snapshot_idx
ON kpi.drilldown_refs(snapshot_id);

CREATE INDEX IF NOT EXISTS drilldown_refs_breakdown_idx
ON kpi.drilldown_refs(breakdown_id);

CREATE INDEX IF NOT EXISTS drilldown_refs_budget_fact_idx
ON kpi.drilldown_refs(budget_fact_id);
