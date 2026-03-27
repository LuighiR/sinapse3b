CREATE TABLE IF NOT EXISTS core.call_facts (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  source_table text NOT NULL,
  source_record_id integer NOT NULL,
  domain_uuid text,
  xml_cdr_uuid text,
  direction text,
  caller_number text,
  destination_number text,
  extension_uuid text,
  started_at timestamp without time zone NOT NULL,
  ended_at timestamp without time zone,
  duration_seconds numeric(19, 4) NOT NULL DEFAULT 0,
  record_path text,
  record_name text,
  hangup_cause text,
  sip_hangup_disposition text,
  is_inbound_to_company boolean NOT NULL DEFAULT FALSE,
  is_received boolean NOT NULL DEFAULT FALSE,
  is_lost boolean NOT NULL DEFAULT FALSE,
  agent_resolution_type text,
  agent_resolution_key text,
  agent_extension_number text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT call_facts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES core.sinapse_clients(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS call_facts_client_source_record_key
ON core.call_facts(client_id, source_table, source_record_id);

CREATE INDEX IF NOT EXISTS call_facts_client_started_at_idx
ON core.call_facts(client_id, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_inbound_started_idx
ON core.call_facts(client_id, is_inbound_to_company, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_received_started_idx
ON core.call_facts(client_id, is_received, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_lost_started_idx
ON core.call_facts(client_id, is_lost, started_at);

CREATE INDEX IF NOT EXISTS call_facts_client_agent_started_idx
ON core.call_facts(client_id, agent_resolution_key, started_at);
