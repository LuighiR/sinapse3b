CREATE TABLE IF NOT EXISTS core.refresh_jobs (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  client_id text NOT NULL,
  slug text NOT NULL,
  trigger_type text NOT NULL,
  requested_from date NOT NULL,
  requested_to date NOT NULL,
  status text NOT NULL,
  requested_at timestamp without time zone NOT NULL DEFAULT NOW(),
  started_at timestamp without time zone,
  finished_at timestamp without time zone,
  error_message text,
  results_json jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_jobs_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES core.tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT refresh_jobs_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS refresh_jobs_tenant_requested_idx
ON core.refresh_jobs(tenant_id, requested_at);

CREATE INDEX IF NOT EXISTS refresh_jobs_client_requested_idx
ON core.refresh_jobs(client_id, requested_at);

CREATE INDEX IF NOT EXISTS refresh_jobs_status_requested_idx
ON core.refresh_jobs(status, requested_at);
