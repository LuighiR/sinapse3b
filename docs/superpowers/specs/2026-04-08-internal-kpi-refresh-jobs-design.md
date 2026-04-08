# Internal KPI Refresh Jobs Design

Date: 2026-04-08
Project: Sinapse backend asynchronous internal KPI refresh jobs
Status: Approved in conversation

## Goal

Evolve the internal KPI refresh endpoint into an asynchronous job-based flow backed by a dedicated `core.refresh_jobs` table so automation callers receive a fast acknowledgment instead of waiting for long-running refresh work.

## Relationship To Existing Design

This spec extends:

- `docs/superpowers/specs/2026-03-20-sinapse-kpi-backend-design.md`
- `docs/superpowers/specs/2026-03-25-calls-kpi-design.md`
- `docs/superpowers/specs/2026-04-06-internal-kpi-refresh-job-design.md`

It keeps reusing the existing refresh-capable services already approved for:

- `POST /kpis/budgets/refresh`
- `POST /kpis/sales/refresh`
- `POST /kpis/calls/refresh`

Important contract update:

- this spec supersedes the synchronous `200` response behavior previously approved for `POST /internal/jobs/kpis/refresh`
- the endpoint now accepts the request, creates a persisted job, and returns `202 Accepted`

## Product Intent

The user needs the internal refresh trigger to be safe for cron, HTTPS callbacks, and reverse proxies that may timeout long POST requests.

The new flow must:

- keep machine authentication through `X-Job-Key`
- accept one tenant per call using `slug`, `from`, and `to`
- resolve the active tenant and backend client before accepting the work
- persist job state in the database
- return immediately with `task initiated`
- execute `budgets`, `sales`, and `calls` in background
- expose a read endpoint for later status inspection

This slice remains backend-only and is intended for automation callers.

## Scope

This spec covers:

- adding a dedicated `core.refresh_jobs` table and Prisma model
- converting `POST /internal/jobs/kpis/refresh` into an asynchronous job-creation endpoint
- adding `GET /internal/jobs/kpis/refresh/:jobId` for job status lookup
- persisting the consolidated refresh outcome in `results_json`
- keeping the same tenant resolution and job-key security model
- adding automated coverage for schema, persistence, async orchestration, and endpoint behavior

This spec does not cover:

- frontend changes
- batch multi-tenant refresh requests
- separate child tables for per-step rows
- queue infrastructure outside the application process
- retries, deduplication, or rate limiting

## Approved Persistence Model

Create a dedicated `core.refresh_jobs` table.

Approved columns:

- `id`
- `tenant_id`
- `client_id`
- `slug`
- `trigger_type`
- `requested_from`
- `requested_to`
- `status`
- `requested_at`
- `started_at`
- `finished_at`
- `error_message`
- `results_json`
- `created_at`
- `updated_at`

Approved `trigger_type` values:

- `api`

Approved status values:

- `PENDING`
- `RUNNING`
- `SUCCESS`
- `PARTIAL_SUCCESS`
- `FAILED`

Approved semantics:

- one row represents one requested refresh job
- `tenant_id` records the resolved tenant context
- `client_id` records the real backend client id used by the refresh services
- `slug` records the original request target
- `results_json` stores the aggregated step-level output for `budgets`, `sales`, and `calls`
- no separate `refresh_job_steps` table is required in this slice

Approved `results_json` shape:

```json
{
  "overallStatus": "partial_success",
  "results": [
    {
      "job": "budgets",
      "status": "success",
      "startedAt": "2026-04-08T12:00:00.000Z",
      "finishedAt": "2026-04-08T12:00:03.000Z"
    },
    {
      "job": "sales",
      "status": "failed",
      "startedAt": "2026-04-08T12:00:03.000Z",
      "finishedAt": "2026-04-08T12:00:05.000Z",
      "error": "Sale refresh failed"
    },
    {
      "job": "calls",
      "status": "success",
      "startedAt": "2026-04-08T12:00:05.000Z",
      "finishedAt": "2026-04-08T12:00:08.000Z"
    }
  ]
}
```

## Approved Endpoints

### `POST /internal/jobs/kpis/refresh`

Purpose:

- validate the request
- resolve tenant scope
- create a persisted refresh job
- return immediately with the accepted job id

Approved inputs:

- `slug` required
- `from` required
- `to` required

Input transport:

- `slug`, `from`, and `to` must stay in the query string
- `X-Job-Key` stays in the request header

Rejected inputs:

- any query parameter other than `slug`, `from`, and `to`

Required header:

- `X-Job-Key`

Approved response status:

- `202 Accepted`

Approved response shape:

```json
{
  "status": "accepted",
  "message": "task initiated",
  "jobId": "123"
}
```

Approved behavior:

- the endpoint must not require `Authorization`
- the endpoint must not require `X-Tenant-Id`
- the endpoint must resolve tenant and backend client before creating the job
- the endpoint must create `refresh_jobs.status = PENDING`
- the endpoint must persist `refresh_jobs.trigger_type = api`
- the endpoint must trigger background processing after persistence succeeds
- the endpoint must not wait for `budgets`, `sales`, and `calls` to finish before responding

### `GET /internal/jobs/kpis/refresh/:jobId`

Purpose:

- return the current persisted state of a previously accepted refresh job

Required header:

- `X-Job-Key`

Approved response status:

- `200 OK`

Approved response shape:

```json
{
  "jobId": "123",
  "status": "RUNNING",
  "slug": "ferracosul-kpi-dev",
  "tenantId": "tenant-1",
  "clientId": "ferracosul",
  "from": "2026-04-01",
  "to": "2026-04-06",
  "triggerType": "api",
  "requestedAt": "2026-04-08T12:00:00.000Z",
  "startedAt": "2026-04-08T12:00:01.000Z",
  "finishedAt": null,
  "errorMessage": null,
  "results": null
}
```

Approved semantics:

- `results` is null while the job has not produced final output
- `results` is populated from `results_json` after completion
- the read endpoint only returns persisted state and must not trigger any recalculation

Approved state mapping:

- `PENDING`
  - `startedAt = null`
  - `finishedAt = null`
  - `errorMessage = null`
  - `results = null`
- `RUNNING`
  - `startedAt` required
  - `finishedAt = null`
  - `errorMessage = null`
  - `results = null`
- `SUCCESS`
  - `startedAt` required
  - `finishedAt` required
  - `errorMessage = null`
  - `results` required
- `PARTIAL_SUCCESS`
  - `startedAt` required
  - `finishedAt` required
  - `errorMessage` optional summary
  - `results` required
- `FAILED`
  - `startedAt` required when execution actually began
  - `finishedAt` required when execution reached a terminal failure state
  - `errorMessage` optional summary
  - `results` required when execution reached family-level outcome aggregation

## Security And Validation

Keep the same environment-based machine auth introduced in the previous internal job slice:

- `INTERNAL_JOB_KEY`

Deployment constraint carried forward from the previous slice:

- `INTERNAL_JOB_KEY` must stay in `envSchema`
- `INTERNAL_JOB_KEY` must stay in `.env.example`
- application startup must fail when `INTERNAL_JOB_KEY` is missing or blank

Approved rules:

- missing key fails before any database write
- invalid key fails before any database write
- the key is global per environment
- the key is required for both `POST` and `GET`

Approved request validation rules:

- `slug` must be present and non-empty
- `from` and `to` must be present and valid through the same `KpiPeriod.between(...)` date semantics already used by KPI refresh services
- the period remains inclusive and based on the existing Sao Paulo date normalization logic
- unexpected query params return `400`
- unknown `slug` returns `404`
- inactive tenant returns `404`
- missing `backendClientId` returns `409`
- inactive backend client returns `409`
- unknown `jobId` on `GET` returns `404`

## HTTP Status Rules

Approved rules:

- `POST` returns `202` when the job is accepted and persisted
- `POST` returns `400` for invalid query input
- `POST` returns `401` or `403` for missing or invalid job key
- `POST` returns `404` for unknown or inactive tenant slug
- `POST` returns `409` for tenant configuration errors after slug resolution
- `GET` returns `200` for an existing job
- `GET` returns `401` or `403` for missing or invalid job key
- `GET` returns `404` for unknown `jobId`

## Tenant Resolution Strategy

Keep the existing machine-job tenant lookup direction:

- resolve by unique tenant `slug`
- require active tenant
- require non-null `backendClientId`
- require active linked backend client

The accepted job row must persist both:

- `tenant_id`
- `client_id = tenant.backendClientId`

This distinction is important because tenant slug and backend client id are not interchangeable concepts in the current model.

## Background Execution Strategy

The accepted job must execute asynchronously after persistence.

Approved flow:

1. validate `X-Job-Key`
2. parse `slug`, `from`, and `to`
3. resolve tenant and backend client
4. create `refresh_jobs` row with `PENDING`
5. return `202 Accepted`
6. start background processing
7. update the job row to `RUNNING` and set `started_at`
8. execute `budgets -> sales -> calls`
9. build aggregated `results_json`
10. update the job row to final status with `finished_at`

Approved execution order:

1. `budgets`
2. `sales`
3. `calls`

Reasoning:

- the current KPI domain already treats `sales` and `calls` as conceptually downstream of budget context
- keeping the same order reduces behavioral drift from the already approved synchronous version

## Failure Handling

Once the job has reached background execution:

- a failure in one family must not block the remaining families
- the background processor must always attempt all three refresh-capable families
- the final job status is:
  - `SUCCESS` when all succeed
  - `PARTIAL_SUCCESS` when at least one succeeds and at least one fails
  - `FAILED` when all three fail

Approved persistence rules:

- `error_message` may store a compact summary of the overall failure state
- `results_json` stores the detailed family-level outcome
- if the application fails before background execution starts, the row may remain `PENDING`
- if the application fails during execution, the row should be left in the last persisted state and operational logs should explain the interruption

## Logging

Use server-side logs for observability.

The implementation should log at least:

- job acceptance with `jobId`, `slug`, and `clientId`
- background start with `jobId`
- start and finish of `budgets`, `sales`, and `calls`
- step-level failure messages
- final job completion with final status

## Recommended Code Shape

### Presentation layer

Keep one controller namespace:

- `POST /internal/jobs/kpis/refresh`
- `GET /internal/jobs/kpis/refresh/:jobId`

The controller should:

- read `X-Job-Key`
- parse and validate inputs
- delegate to an async job service

### Application layer

Split responsibilities into focused services:

- tenant resolver by `slug`
- refresh job creation service
- refresh job execution/orchestration service
- refresh job status query service

Recommended service boundaries:

- one service creates and returns accepted jobs
- one service executes an already-persisted job
- one service reads and shapes persisted job status for API responses

### Infrastructure layer

Add repository support for:

- creating refresh jobs
- moving jobs from `PENDING` to `RUNNING`
- completing jobs with final status and `results_json`
- querying jobs by id

Reuse the existing KPI refresh services directly. Do not issue internal HTTP requests to the public KPI controllers.

## Testing Strategy

Required coverage:

- schema or migration tests proving `refresh_jobs` exists with the expected fields
- parser tests for strict `slug`, `from`, `to` validation
- service tests proving:
  - accepted jobs persist with `PENDING`
  - background execution transitions jobs to `RUNNING`
  - execution uses `tenant.backendClientId`
  - `budgets`, `sales`, and `calls` run in order
  - family failures still allow the remaining families to run
  - final status and `results_json` are persisted correctly
- controller tests proving:
  - `POST` returns `202` with `jobId`
  - `GET` returns persisted state
  - neither route requires JWT nor `X-Tenant-Id`
  - invalid keys are rejected
  - `404` and `409` status mappings are preserved

## Documentation Updates

Update backend API documentation to say:

- `POST /internal/jobs/kpis/refresh` now returns `202 Accepted`
- the response contains `task initiated` and `jobId`
- `GET /internal/jobs/kpis/refresh/:jobId` returns job status
- the flow is automation-only
- the route does not use JWT auth
- the job refreshes `budgets`, `sales`, and `calls`
- tenant scope is resolved by slug, while refresh execution uses the resolved backend `clientId`
