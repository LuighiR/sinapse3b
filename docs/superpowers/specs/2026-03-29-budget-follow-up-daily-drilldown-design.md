# Budget Follow-Up Daily And Drilldown Design

Date: 2026-03-29
Project: Sinapse backend budget follow-up analytics expansion
Status: Approved in conversation

## Goal

Extend the existing budget follow-up backend contract so the API can:

- return a daily follow-up series grouped by follow-up window and follow-up status
- return a drilldown list of budgets filtered by follow-up classification
- support both day-click detail and future full follow-up listing flows without changing classification rules again

## Relationship To Existing Design

This spec extends:

- `docs/superpowers/specs/2026-03-20-sinapse-kpi-backend-design.md`

It also extends the already implemented budget KPI contract that currently includes:

- `GET /kpis/budgets/summary`
- `GET /kpis/budgets/daily`
- `GET /kpis/budgets/drilldown`
- `GET /kpis/budgets/follow-up/summary`

This spec does not replace the current budget KPI behavior. It only adds new follow-up daily and follow-up drilldown capabilities.

## Product Intent

The user wants the follow-up view to behave like the existing budgets experience:

- a daily aggregation endpoint exposes the timeline
- the frontend can click a specific day to inspect the budgets behind that point
- the same drilldown endpoint must also support a future general follow-up listing screen

The project context for this slice is backend-only. No frontend contract changes are designed here beyond the HTTP responses this backend will expose.

## Scope

This spec covers:

- adding a daily follow-up endpoint for budgets
- adding a follow-up drilldown endpoint for detailed budget rows
- defining the approved query filters for both endpoints
- defining a single follow-up classification rule shared by summary, daily, and drilldown responses
- documenting the API contract in `docs/api/rest-api.md`
- adding automated coverage for parser, service, and controller wiring

This spec does not cover:

- frontend charts, interactions, or layout decisions
- changing the existing `GET /kpis/budgets/follow-up/summary` response shape
- changing the raw or canonical budget storage model
- introducing materialized follow-up snapshot tables
- redefining budget status normalization

## Approved Endpoints

### `GET /kpis/budgets/follow-up/daily`

Purpose:

- return the follow-up series per day for all six follow-up groups

Approved query params:

- `from` required
- `to` required
- `referenceAt` required
- `sellerId` optional
- `orderType` optional

Response shape:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-03",
    "key": "2026-01-01_2026-01-03"
  },
  "rows": [
    {
      "date": "2026-01-01",
      "window": "within24h",
      "status": "converted",
      "count": 1,
      "value": "100.0000"
    },
    {
      "date": "2026-01-01",
      "window": "within24h",
      "status": "lost",
      "count": 0,
      "value": "0.0000"
    },
    {
      "date": "2026-01-01",
      "window": "within24h",
      "status": "open",
      "count": 2,
      "value": "80.0000"
    },
    {
      "date": "2026-01-01",
      "window": "after24h",
      "status": "converted",
      "count": 0,
      "value": "0.0000"
    },
    {
      "date": "2026-01-01",
      "window": "after24h",
      "status": "lost",
      "count": 0,
      "value": "0.0000"
    },
    {
      "date": "2026-01-01",
      "window": "after24h",
      "status": "open",
      "count": 1,
      "value": "25.0000"
    }
  ]
}
```

Approved output enums:

- `window`: `within24h` or `after24h`
- `status`: `converted`, `lost`, or `open`

### `GET /kpis/budgets/follow-up/drilldown`

Purpose:

- return the budget rows that belong to a follow-up classification
- support both clicked-day detail and a future full follow-up listing

Approved query params:

- `from` required
- `to` required
- `referenceAt` required
- `date` optional
- `followUpWindow` optional: `within24h` or `after24h`
- `followUpStatus` optional: `converted`, `lost`, or `open`
- `sellerId` optional
- `orderType` optional

Approved response shape:

- keep the current budget drilldown row contract as the audit baseline
- add the follow-up classification fields to each row:
  - `followUpWindow`
  - `followUpStatus`
- expose the applied follow-up filters in the top-level `filters` block

Approved drilldown filters payload:

- `referenceAt` required
- `date` optional
- `followUpWindow` optional
- `followUpStatus` optional
- `sellerId` optional
- `orderType` optional

Example response:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "filters": {
    "referenceAt": "2026-01-31T18:30:00-03:00",
    "date": "2026-01-05",
    "followUpWindow": "within24h",
    "followUpStatus": "open",
    "sellerId": 7,
    "orderType": "Balcao"
  },
  "rows": [
    {
      "id": "99",
      "sourceTable": "raw.ferraco_budgets",
      "sourceRecordId": 123,
      "budgetDate": "2026-01-05",
      "budgetDatetime": "2026-01-05T12:00:00.000Z",
      "closingDate": null,
      "branchId": 5,
      "branchName": "Matriz",
      "sellerId": 7,
      "sellerName": "Maria",
      "statusNormalized": "OPEN",
      "channel": "Balcao",
      "customerName": "ACME LTDA",
      "cpfCnpj": null,
      "valueAmount": "200.0000",
      "sequential": null,
      "davId": "777",
      "sequentialLinkedSale": null,
      "payloadJson": {},
      "followUpWindow": "within24h",
      "followUpStatus": "open"
    }
  ]
}
```

## Follow-Up Classification Rules

The existing `GET /kpis/budgets/follow-up/summary` endpoint already defines the approved follow-up semantics. This spec requires that the new daily and drilldown endpoints use the exact same classification logic.

### Input population rules

The system first selects budgets by their opening period:

- `budgetDate` and `budgetDatetime` must fall within the requested `from` and `to` period according to the existing budget KPI period behavior

The follow-up calculation then evaluates the state of each selected budget at `referenceAt`.

### `referenceAt` parsing

`referenceAt` must keep the same parsing semantics already approved for follow-up summary:

- timezone-aware timestamps are used as sent
- if the input matches `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss` without an explicit timezone, the backend must interpret it as Sao Paulo time and normalize it to `-03:00`
- invalid timestamps must return `400`

### Status resolution

Normalized budget statuses continue to map as:

- `WON` -> `converted`
- `LOST` -> `lost`
- `OPEN` -> `open`

Important rule:

- `WON` or `LOST` only remain closed classifications if the budget already closed at or before `referenceAt`
- if the budget closed after `referenceAt`, or there is not enough closing information to confirm closure before `referenceAt`, it must be classified as `open` for that query

### Window resolution

The follow-up window must continue to be derived from elapsed time between opening and the correct reference point:

- `converted` and `lost` use `opening -> closingAt`
- `open` uses `opening -> referenceAt`

Approved buckets:

- `within24h` when elapsed time is less than or equal to 24 hours
- `after24h` when elapsed time is greater than 24 hours

### Closing timestamp rules

The existing budget follow-up summary rules remain the source of truth:

- when `closingDate` and a valid `closing_time` are present, combine them into `closingAt`
- when `closingDate` exists but `closing_time` is absent, resolve `closingAt` as the end of the Sao Paulo day represented by `closingDate`
- when `closingDate` is absent, the close cannot be confirmed and the budget must be treated as `open`
- when `closingDate` exists but `closing_time` is malformed, the implementation should fall back to the end of the Sao Paulo day represented by `closingDate`
- a budget opened after `referenceAt` must be ignored from follow-up calculations entirely
- records with unknown normalized status or invalid opening timestamp must be ignored from follow-up calculations

Canonical implementation rule:

- summary, daily, and drilldown follow-up endpoints must all use this same `closingAt` resolution chain verbatim

## Daily Endpoint Behavior

`GET /kpis/budgets/follow-up/daily` groups classified budgets by:

- `budgetDate`
- `followUpWindow`
- `followUpStatus`

Approved grouping semantics:

- the date bucket is always the budget opening date
- the endpoint must return six rows per day for every day in the requested period
- missing groups must be zero-filled with `count = 0` and `value = "0.0000"`

Approved ordering:

- sort by `date`
- then by `window` in this fixed order:
  - `within24h`
  - `after24h`
- then by `status` in this fixed order:
  - `converted`
  - `lost`
  - `open`

This ordering is part of the contract so consumers can render the series deterministically.

## Drilldown Endpoint Behavior

`GET /kpis/budgets/follow-up/drilldown` uses the same base canonical budget records as the current budget drilldown flow, but filters them through the follow-up classifier before serialization.

### Approved filters

#### `date`

- optional
- filters by the opening date bucket used in the daily follow-up series
- this is intentionally the same date the user can click in the daily chart

#### `followUpWindow`

- optional
- filters the rows after classification to only `within24h` or `after24h`

#### `followUpStatus`

- optional
- filters the rows after classification to only `converted`, `lost`, or `open`

#### `sellerId`

- optional
- keeps the existing budget KPI meaning:
  - `sellerId = core.employees.erp_id`

#### `orderType`

- optional
- keeps the same normalized label comparison already used in other budget endpoints

### No-filter behavior

When `date`, `followUpWindow`, and `followUpStatus` are all absent:

- the endpoint must return every classified budget within the opening period and other optional filters

This behavior is explicitly approved so the same endpoint can power a future general follow-up listing screen.

Even in this no-classification-filter mode:

- `referenceAt` remains mandatory and must always be echoed in `filters`
- `sellerId` and `orderType` still apply when provided and must be echoed in `filters`

### Row enrichment

Each returned row must add:

- `followUpWindow`
- `followUpStatus`

These values must be derived by the same helper used by summary and daily follow-up queries so the clicked-day detail matches the aggregate numbers exactly.

### Default ordering

For deterministic listing behavior, the drilldown rows must be ordered by:

- `budgetDatetime` descending
- `budgetDate` descending as a fallback tie-breaker when needed
- `id` descending as the final deterministic tie-breaker

This ordering applies even when no `date`, `followUpWindow`, or `followUpStatus` filters are supplied.

## Recommended Code Shape

### Presentation layer

Add two new parsers:

- one for `follow-up/daily`
- one for `follow-up/drilldown`

The parsers should:

- validate `from` and `to` with the existing KPI period rules
- validate `referenceAt` with the same rules already used by follow-up summary
- normalize optional filters
- reject invalid `followUpWindow`, `followUpStatus`, or malformed `date`

Controller methods should only parse and forward the approved filters to the query service.

### Application layer

Extend `BudgetKpiQueryService` with:

- a daily follow-up method
- a follow-up drilldown method

The service should extract a shared follow-up classification helper that:

- receives a canonical budget fact plus `referenceAt`
- returns the resolved follow-up window and follow-up status when the record is valid for follow-up
- centralizes all skip rules and classification rules used by follow-up summary, daily, and drilldown

Recommended internal shape:

- one method to fetch the filtered canonical budget facts for follow-up inputs
- one method to classify a single fact
- daily aggregation built from the classified facts
- drilldown rows serialized from classified facts or classified drilldown rows

Important design rule:

- `GET /kpis/budgets/follow-up/summary` should be refactored to reuse the same classification helper instead of keeping follow-up logic inline

### Drilldown row contract

The current `budgets/drilldown` row shape remains the base shape.

The follow-up drilldown row extends it by adding:

- `followUpWindow`
- `followUpStatus`

This keeps the response audit-friendly while exposing the extra classification needed by follow-up screens.

The top-level drilldown `filters` object must include:

- `referenceAt`
- `date` when provided
- `followUpWindow` when provided
- `followUpStatus` when provided
- `sellerId` when provided
- `orderType` when provided

## Error Handling

Validation rules should remain straightforward and consistent with the existing budget query style:

- invalid periods return `400`
- invalid or missing `referenceAt` returns `400`
- invalid `sellerId` returns the existing safe integer validation error path
- invalid `date` returns `400`
- invalid `followUpWindow` returns `400`
- invalid `followUpStatus` returns `400`
- empty-string optional filters should be treated as absent where that matches existing parser behavior

## Testing Strategy

Required coverage:

- parser tests for:
  - `follow-up/daily`
  - `follow-up/drilldown`
  - invalid `referenceAt`
  - invalid `date`
  - invalid follow-up enums
- service tests proving:
  - daily aggregation returns six zero-filled groups per day
  - drilldown filtering by `date`, `followUpWindow`, and `followUpStatus`
  - records opened after `referenceAt` are excluded
  - records without resolvable closure remain `open`
  - summary and daily/drilldown share the same classification outcomes
- controller or e2e tests proving:
  - both routes are tenant-scoped
  - parsed filters reach the service contract correctly
  - missing required `referenceAt` returns `400`

## Documentation Updates

Update `docs/api/rest-api.md` to include:

- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`

The REST documentation must explicitly say:

- `date` refers to the budget opening date bucket
- `followUpWindow` and `followUpStatus` are classification filters, not raw budget status filters
- the same follow-up classification is shared by summary, daily, and drilldown endpoints
