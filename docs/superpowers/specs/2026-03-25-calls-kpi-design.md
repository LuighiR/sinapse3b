# Calls KPI Design

Date: 2026-03-25
Project: Sinapse backend calls KPI pipeline
Status: Approved in conversation

## Goal

Add a first KPI family for phone calls that supports:

- received calls
- lost calls
- agent ranking
- open telemarketing budgets
- hourly call peak
- hourly comparison between calls and telemarketing budgets

The solution must preserve historical consistency even when employees are not yet registered in the system.

## Product Intent

The user needs operational call KPIs backed by the real telephony data already available in `raw.ferraco_calls`.

The critical business requirement is not only counting calls. The system must also keep the history usable while the employee registry is incomplete.

That means the KPI layer must:

- return results by employee when a matching employee exists
- fall back to the extension number when no employee is registered yet
- preserve enough information so the same historical calls can later resolve to employee names once registrations are added

This KPI family should follow the same backend pattern already used for budgets and sales:

- normalize raw source data into a canonical `core` fact table
- materialize KPI snapshots and breakdowns into the `kpi` schema
- expose query endpoints that can read from materialized data and fall back to canonical facts when needed

## Scope

This spec covers:

- normalization of `raw.ferraco_calls` into a new canonical calls fact table
- KPI refresh and query services for calls
- summary, hourly, agent ranking, and hourly comparison endpoints
- consistent identity resolution for employee or extension display
- integration with `core.budget_facts` for telemarketing budget comparison

This spec does not cover:

- telephony recordings playback
- outbound call KPIs
- local/internal call KPIs
- branch attribution for calls
- a full CRUD flow for employee registration
- frontend dashboard implementation details

## Validated Data Findings

The database was inspected before the design was finalized.

Relevant findings:

- `raw.ferraco_calls` contains the fields needed for this slice, including `extension_uuid`, `direction`, `caller_id_number`, `destination_number`, `date_start`, `duration`, `hangup_cause`, and `sip_hangup_disposition`
- the relevant business slice should use only inbound calls
- `recv_cancel` lost calls usually come with `extension_uuid = null`, so lost-call attribution needs a destination fallback
- `core.employees` is currently empty in the inspected database, so the KPI layer cannot depend on employee registration being complete
- telemarketing budgets are already represented in `core.budget_facts` through `channel = 'Pedido Televendas'`
- open telemarketing budgets are already available through `status_normalized = 'OPEN'`

These findings are implementation-critical because they explain why ranking cannot depend only on `extension_uuid`.

## Source Rules

The source table for this KPI family is `raw.ferraco_calls`.

Approved business rules:

- only inbound calls should count toward the KPI family
- only rows where `destination_number` is a short numeric extension should count as inbound-to-company calls
- calls should not be counted as company inbound calls when the employee extension appears as the caller number
- lost calls must include `recv_cancel` even though that disposition usually comes with `extension_uuid = null`
- telemarketing budget metrics must come from `core.budget_facts` with `channel = 'Pedido Televendas'`

For the first implementation, "short numeric extension" should be interpreted using the observed dataset shape:

- `destination_number ~ '^\d{2,5}$'`
- the same short-extension rule should be used when defensively rejecting internally-originated caller numbers

## Canonical Model

The recommended canonical layer is a new `core.call_facts` table.

This mirrors the existing `core.budget_facts` and `core.sale_facts` pattern and keeps call classification logic in one place.

### Proposed columns

- `id`
- `client_id`
- `source_table`
- `source_record_id`
- `domain_uuid`
- `xml_cdr_uuid`
- `direction`
- `caller_number`
- `destination_number`
- `extension_uuid`
- `started_at`
- `ended_at`
- `duration_seconds`
- `record_path`
- `record_name`
- `hangup_cause`
- `sip_hangup_disposition`
- `is_inbound_to_company`
- `is_received`
- `is_lost`
- `agent_resolution_type`
- `agent_resolution_key`
- `agent_extension_number`
- `payload_json`
- `created_at`
- `updated_at`

### Required uniqueness

The canonical table should keep a uniqueness rule aligned with the other fact tables:

- unique on `client_id`, `source_table`, `source_record_id`

### Canonical write behavior

Normalization should upsert by source row identity so refreshes remain idempotent.

## Call Classification Rules

The canonical layer should derive these booleans during normalization.

### `is_inbound_to_company`

True when all rules below match:

- `direction = 'inbound'`
- `destination_number` matches the short-extension rule
- `caller_number` is not interpreted as a short internal extension

The last rule is defensive. The inspected dataset showed no inbound rows with short internal caller numbers, but the user explicitly asked that internally-originated calls must not be counted in this KPI family.

### `is_lost`

True when:

- the row is `is_inbound_to_company = true`
- and one of the following is true:
  - `sip_hangup_disposition = 'recv_cancel'`
  - `sip_hangup_disposition = 'send_cancel'`
  - `sip_hangup_disposition = 'send_refuse'`

### `is_received`

True when:

- the row is `is_inbound_to_company = true`
- `extension_uuid` is not null
- `is_lost = false`

This keeps the definition consistent with the approved rule that answered inbound calls should only count when an extension actually handled them.

## Agent Identity Resolution

This is the most important part of the design.

The KPI must remain historically stable even before employees are registered.

### Resolution fields

`core.call_facts` should persist:

- `agent_resolution_type`
- `agent_resolution_key`
- `agent_extension_number`

### Resolution precedence

During normalization, the identity should be derived like this:

1. if `extension_uuid` is present, use it as the primary operational identity
2. otherwise, for lost inbound calls such as `recv_cancel`, use `destination_number` as the fallback operational identity
3. always persist `agent_extension_number = destination_number` for valid inbound-to-company calls

Recommended values:

- when `extension_uuid` exists:
  - `agent_resolution_type = 'EXTENSION_UUID'`
  - `agent_resolution_key = extension_uuid`
- when lost inbound fallback is needed:
  - `agent_resolution_type = 'EXTENSION_NUMBER'`
  - `agent_resolution_key = destination_number`

### Employee display resolution

Query-time display should resolve like this:

1. try matching `core.employees.extension_uuid = core.call_facts.extension_uuid`
2. if no match is possible and the row only has extension-number identity, try matching `core.employees.extension_number = core.call_facts.agent_extension_number`
3. if no employee is found, display the extension number as the label

This gives the desired behavior:

- current data still returns useful ranking rows even with no employees registered
- future employee registrations can enrich historical displays without rewriting the raw source

## KPI Definitions

The calls family should define four materialized KPI surfaces.

### `calls.summary`

Summary snapshots for:

- `received.count`
- `lost.count`
- `total_inbound.count`
- `telemarketing_open_budgets.count`
- `peak_hour.count`

The `peak_hour` snapshot should also store the hour bucket in `dimensions_json`.

### `calls.hourly`

Hourly breakdown with 24 buckets from `00` to `23`.

Metrics per bucket:

- `received.count`
- `lost.count`
- `total_inbound.count`

### `calls.agent_ranking`

Breakdown grouped by resolved agent identity.

Metrics per row:

- `received.count`
- `lost.count`
- `total_inbound.count`

Payload fields should include:

- `agentType`
- `employeeName`
- `extensionNumber`
- `extensionUuid`
- `fallbackDestinationNumber`

`agentType` should use:

- `EMPLOYEE`
- `EXTENSION`

### `calls.hourly_comparison`

Hourly breakdown with 24 buckets from `00` to `23`.

Metrics per bucket:

- `received.count`
- `lost.count`
- `telemarketing_budget.count`

The telemarketing metric must be sourced from `core.budget_facts`, grouped by `budget_datetime` hour, filtered by:

- `channel = 'Pedido Televendas'`

## API Surface

The recommended controller root is:

- `kpis/calls`

### `POST /kpis/calls/refresh`

Purpose:

- normalize raw calls into `core.call_facts`
- materialize the calls KPI definitions for the selected period

Accepted query contract:

- `from`
- `to`

### `GET /kpis/calls/summary`

Returns:

- `received`
- `lost`
- `totalInbound`
- `telemarketingOpenBudgets`
- `peakHour`

Recommended peak-hour shape:

- hour bucket label
- total inbound count for that bucket

### `GET /kpis/calls/hourly`

Returns 24 rows for hours `00` through `23` with:

- `receivedCount`
- `lostCount`
- `totalInboundCount`

### `GET /kpis/calls/agents/ranking`

Returns ranking rows ordered by:

- `receivedCount desc`
- then `totalInboundCount desc`
- then label asc

Each row should contain:

- `agentType`
- `agentKey`
- `agentLabel`
- `employeeName`
- `extensionNumber`
- `receivedCount`
- `lostCount`
- `totalInboundCount`

### `GET /kpis/calls/hourly/comparison`

Returns 24 rows for hours `00` through `23` with:

- `receivedCount`
- `lostCount`
- `telemarketingBudgetCount`

## Refresh Flow

The refresh flow should mirror the existing KPI families:

1. validate `from` and `to`
2. ensure KPI definitions exist
3. create a `kpi.calculation_runs` row with `RUNNING`
4. normalize raw calls into `core.call_facts`
5. load canonical call facts for the requested period
6. load telemarketing budget facts for the same period
7. build summary snapshots
8. build hourly call breakdowns
9. build agent ranking breakdowns
10. build hourly comparison breakdowns
11. persist snapshots and breakdowns
12. mark KPI availability
13. complete the calculation run as `COMPLETED`

If any step fails, the run must finish as `FAILED`.

## Query Strategy

The query side should behave like the current budget and sales services.

Recommended strategy:

- read from materialized snapshots and breakdowns first
- if materialized rows are missing or effectively empty, fall back to `core.call_facts`
- never query `raw.ferraco_calls` directly from KPI query endpoints

This keeps raw-source interpretation centralized in the normalization layer.

## Hour Bucketing

The user explicitly requested hour-based grouping without minute-level buckets.

All hour KPIs should therefore:

- group by the hour extracted from the timestamp
- ignore minute and second differences
- produce fixed zero-filled output for all `00` to `23` buckets
- use the stored business timestamps consistently, without per-request timezone shifting inside the KPI calculation

This applies to:

- call peak hour
- hourly call series
- hourly comparison with telemarketing budgets

## Telemarketing Budget Rules

The calls KPI family does not own telemarketing budget data.

It only reads the budget facts needed for comparison metrics.

Approved rules:

- telemarketing budgets are defined by `core.budget_facts.channel = 'Pedido Televendas'`
- open telemarketing budgets use `status_normalized = 'OPEN'`
- hourly comparison uses the hour extracted from `budget_datetime`

## Recommended Code Shape

The implementation should stay close to the existing module structure.

Recommended additions:

- `src/modules/normalization/application/call-normalization.service.ts`
- `src/modules/kpi/application/call-kpi-refresh.service.ts`
- `src/modules/kpi/application/call-kpi-query.service.ts`
- `src/modules/kpi/presentation/call-kpi.controller.ts`

Repository wiring can stay in the existing `src/modules/kpi/kpi.module.ts` pattern.

## Testing Priorities

Tests should cover both classification correctness and fallback identity behavior.

Required test focus:

- normalization of valid inbound-to-company rows
- exclusion of outbound and local rows from the KPI family
- defensive exclusion of internally-originated extension caller rows
- `is_received` classification
- `is_lost` classification for `recv_cancel`
- `is_lost` classification for `send_cancel`
- `is_lost` classification for `send_refuse`
- fallback identity resolution by `destination_number`
- display resolution to employee when an employee later matches by `extension_uuid`
- display resolution to employee when only `extension_number` can be matched
- ranking fallback to extension label when no employee exists
- zero-filled hourly buckets
- peak-hour calculation
- hourly comparison with `Pedido Televendas`
- summary, hourly, ranking, and comparison endpoint behavior

## Success Criteria

This KPI family is successful when:

- the backend can refresh call KPIs from real telephony data
- inbound received and lost counts follow the approved rules
- lost calls with `recv_cancel` are included even when `extension_uuid` is null
- ranking remains usable before employee registration is complete
- ranking shows employee names when employees are later registered
- missing employee registration falls back to extension display instead of hiding the result
- telemarketing open budgets are exposed from `core.budget_facts`
- hourly charts operate on hour buckets only
- the implementation fits the existing normalization and KPI architecture already used by budgets and sales
