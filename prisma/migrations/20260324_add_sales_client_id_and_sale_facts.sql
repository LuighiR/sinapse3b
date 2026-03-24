ALTER TABLE raw.ferraco_sales
ADD COLUMN IF NOT EXISTS client_id text;

CREATE INDEX IF NOT EXISTS ferraco_sales_client_id_idx
ON raw.ferraco_sales(client_id);

DO $$
DECLARE
  preferred_client_id constant text := 'ferracosul';
  preferred_client_slug constant text := 'ferracosul';
  preferred_client_name constant text := 'Ferracosul';
  resolved_client_id text;
BEGIN
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ferraco_sales_client_id_fkey'
      AND conrelid = 'raw.ferraco_sales'::regclass
  ) THEN
    ALTER TABLE raw.ferraco_sales
    ADD CONSTRAINT ferraco_sales_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  preferred_client_id constant text := 'ferracosul';
BEGIN
  UPDATE raw.ferraco_sales
  SET client_id = preferred_client_id
  WHERE client_id IS NULL;
END $$;

CREATE TABLE IF NOT EXISTS core.sale_facts (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  source_table text NOT NULL,
  source_record_id integer NOT NULL,
  branch_name text NOT NULL,
  branch_id integer,
  seller_id integer NOT NULL,
  seller_name text NOT NULL,
  sale_date date NOT NULL,
  sale_datetime timestamp without time zone NOT NULL,
  status_raw text,
  status_normalized text NOT NULL DEFAULT 'UNKNOWN',
  channel text,
  has_linked_budget boolean NOT NULL DEFAULT FALSE,
  linked_budget_source_record_id integer,
  customer_name text NOT NULL,
  cpf_cnpj text,
  value_amount numeric(19, 4) NOT NULL,
  sequential bigint,
  invoice_serie bigint,
  invoice_numeric bigint,
  list_davs_id text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_facts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT sale_facts_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_facts_client_source_record_key
ON core.sale_facts(client_id, source_table, source_record_id);

CREATE INDEX IF NOT EXISTS sale_facts_client_sale_date_idx
ON core.sale_facts(client_id, sale_date);

CREATE INDEX IF NOT EXISTS sale_facts_client_seller_sale_date_idx
ON core.sale_facts(client_id, seller_id, sale_date);

CREATE INDEX IF NOT EXISTS sale_facts_client_branch_sale_date_idx
ON core.sale_facts(client_id, branch_id, sale_date);
