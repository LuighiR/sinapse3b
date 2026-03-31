# Budget Cancellation Follow-up Adjustment Design

## Context

The budgets backend already calculates follow-up from the budget opening timestamp (`budgetDatetime`) and a terminal timestamp used to classify each budget as `converted`, `lost`, or `open` at `referenceAt`.

Today:

- `WON` uses `closingDate` and, when available, `closing_time`
- `LOST` still depends on the same closing logic, which prevents canceled budgets from being classified with the new `cancellation_date` + `cancelation_time` fields

The database now already stores and populates the cancellation fields for budgets, so the backend needs to ingest, expose, and use them.

## Goal

Update the backend so that it:

- persists `cancellationDate` and `cancelationTime` in budget facts
- uses `cancellationDate + cancelationTime` to calculate follow-up for canceled budgets (`LOST`)
- keeps the current `WON` logic based on `closingDate + closing_time`
- preserves the end-of-day fallback when the terminal time is empty, invalid, or missing

## Chosen Approach

Reuse the shared follow-up classifier and extend terminal timestamp resolution by status:

- `WON` resolves terminal time from `closingDate` and `closing_time`
- `LOST` resolves terminal time from `cancellationDate` and `cancelationTime`
- `OPEN` continues to use `referenceAt`

This keeps summary, daily, and drilldown aligned without duplicating status/window logic in multiple services.

## Scope

### 1. Schema and normalization chain

The change must start in the ingestion path that populates `core.budget_facts`, not only in the query layer.

Files in scope:

- `prisma/schema.prisma`
- `src/modules/normalization/application/budget-normalization.service.ts`
- the Prisma/manual upsert flow into `core.budget_facts`

Canonical naming by layer:

- database and Prisma model fields: `cancellationDate` and `cancelationTime`
- legacy JSON compatibility: still accept `cancelation_time` or `cancelationTime` when reading from payloads
- normalized `payloadJson`: also store `cancelation_time` when a valid raw value exists, matching the current pattern already used for `closing_time`

Expected `BudgetFact` additions:

- `cancellationDate` mapped to `cancellation_date`
- `cancelationTime` mapped to `cancelation_time`

The normalization flow must:

- read `budget.cancellation_date AS "cancellationDate"` and `budget.cancelation_time::text AS "cancelationTime"` from `raw.ferraco_budgets`
- read the raw cancellation date/time from `raw.ferraco_budgets`
- persist them into `core.budget_facts`
- keep payload compatibility for downstream fallback logic

### 2. Budget KPI query shapes

Expose the new fields in the budget KPI types and repository selects used by the query service:

- `BudgetFactRecord`
- `BudgetKpiDrilldownFactRow`
- `BudgetFollowUpSourceRecord`
- Prisma selects in the budgets KPI repository
- drilldown serialization in `toDrilldownRow`

Expected application fields:

- `cancellationDate`
- `cancelationTime`

### 3. Follow-up classifier

The classifier should stop resolving a single generic `closingAt` and instead resolve a status-specific terminal timestamp:

- for `converted`, read `closingDate` plus `closing_time` or `closingTime`
- for `lost`, first read structured `cancellationDate` plus `cancelationTime`
- if structured cancellation fields are absent, keep compatibility with legacy payload keys `cancellation_date` or `cancellationDate` for the date, and `cancelation_time` or `cancelationTime` for the time
- precedence for mixed data must be explicit:
- when structured and legacy values both exist, structured `cancellationDate` and `cancelationTime` win
- when only structured date exists, combine it with structured time if valid; otherwise use end of day
- when only legacy date exists, combine it with legacy time if valid; otherwise use end of day
- when date comes from one source and time from another, do not merge cross-source pairs; prefer a complete or date-led pair from the same source before falling back
- if the terminal date is absent or invalid, the budget remains `open` at `referenceAt`
- if the terminal date exists but the time is absent or invalid, use end of day in `America/Sao_Paulo`

Expected behavior:

- a `LOST` budget is counted as `lost` only when `referenceAt` is equal to or after its effective cancellation timestamp
- before that moment, it remains `open`
- the follow-up window (`within24h` or `after24h`) is calculated from opening time to the effective cancellation timestamp

### 4. Endpoints affected

Behavior changes, with no filter contract change, apply to:

- `GET /kpis/budgets/follow-up/summary`
- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`

### 5. Drilldown contract

The new cancellation fields should be exposed explicitly in both budget drilldowns:

- `GET /kpis/budgets/drilldown`
- `GET /kpis/budgets/follow-up/drilldown`

Response shape additions:

- `cancellationDate: string | null`
- `cancelationTime: string | null`

For `GET /kpis/budgets/follow-up/drilldown`, these fields are additive only.
The existing follow-up classification fields remain part of the response:

- `followUpWindow`
- `followUpStatus`

This keeps the payload aligned with the database and allows cancellation auditing in both the generic and follow-up drilldowns.

## Testing Strategy

Implement in TDD with coverage for:

- normalization persisting `cancellation_date` and `cancelation_time` into `budget_facts`
- classifier handling `LOST` with `cancellationDate + cancelationTime`
- classifier fallback to end of day for canceled budgets with missing or invalid time
- classifier keeping `LOST` budgets as `open` when `referenceAt` is earlier than cancellation
- query service summary/daily/drilldown reflecting the new canceled-budget classification
- generic drilldown and follow-up drilldown exposing `cancellationDate` and `cancelationTime`
- regression coverage proving `WON` still works with the current closing logic

## Risks

- spelling differences between `cancellation_*` and `cancelation_*`
- older payloads without the new structured fields
- mixed use of structured fields and legacy payload keys

Mitigation:

- make `cancellationDate` and `cancelationTime` the canonical structured fields
- prefer structured fields whenever available
- keep payload fallback for backward compatibility
- cover both structured and fallback paths in tests
