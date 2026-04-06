# Internal KPI Refresh Job Design

Date: 2026-04-06
Project: Sinapse backend internal KPI refresh endpoint
Status: Approved in conversation

## Goal

Add a backend-only automation endpoint that refreshes all currently supported KPI families for one active tenant using a global job key instead of user JWT authentication.

## Relationship To Existing Design

This spec extends:

- `docs/superpowers/specs/2026-03-20-sinapse-kpi-backend-design.md`
- `docs/superpowers/specs/2026-03-25-calls-kpi-design.md`

It reuses the existing refresh services already approved for:

- `POST /kpis/budgets/refresh`
- `POST /kpis/sales/refresh`
- `POST /kpis/calls/refresh`

## Product Intent

The user needs a cron-friendly backend entrypoint that:

- does not depend on login, refresh tokens, or user sessions
- accepts one tenant per call
- resolves the tenant by slug
- refreshes budgets, sales, and calls for the requested period
- always attempts every supported refresh even if one fails
- returns a compact execution summary that the scheduler can inspect

This slice is intentionally server-side only. It is meant for automation callers such as cron, CI, or a hosting scheduler.

## Scope

This spec covers:

- adding one new internal backend endpoint for KPI refresh orchestration
- protecting that endpoint with a global environment-based job key
- resolving the active tenant and backend client from `slug`
- sequentially executing `budgets`, `sales`, and `calls` refreshes
- returning per-step success or failure details in a single response
- adding automated coverage for auth, parsing, orchestration, and controller wiring

This spec does not cover:

- frontend changes
- IP allowlists or HMAC request signing
- multi-tenant batch refresh in a single request
- queue-based or asynchronous execution
- changes to the existing authenticated KPI refresh endpoints

## Approved Endpoint

### `POST /internal/jobs/kpis/refresh`

Purpose:

- trigger all supported KPI refresh families for one tenant using machine authentication

Approved inputs:

- `slug` required
- `from` required
- `to` required

Rejected inputs:

- any query parameter other than `slug`, `from`, and `to`

Required header:

- `X-Job-Key`

Input transport:

- use query string parameters for `slug`, `from`, and `to`
- use the `X-Job-Key` header for automation authentication

Approved behavior:

- the endpoint must not require `Authorization`
- the endpoint must not require `X-Tenant-Id`
- the endpoint must reject unexpected query parameters instead of forwarding arbitrary filters to the existing refresh services
- the endpoint must resolve the tenant and `clientId` internally from `slug`
- the endpoint must execute refreshes in this order:
  - `budgets`
  - `sales`
  - `calls`
- the endpoint must continue running the remaining refreshes after an individual failure

Approved response shape:

```json
{
  "slug": "ferracosul",
  "clientId": "ferracosul",
  "from": "2026-04-01",
  "to": "2026-04-06",
  "overallStatus": "partial_success",
  "results": [
    {
      "job": "budgets",
      "status": "success",
      "startedAt": "2026-04-06T14:00:00.000Z",
      "finishedAt": "2026-04-06T14:00:03.000Z"
    },
    {
      "job": "sales",
      "status": "failed",
      "startedAt": "2026-04-06T14:00:03.000Z",
      "finishedAt": "2026-04-06T14:00:05.000Z",
      "error": "Sale KPI refresh failed"
    },
    {
      "job": "calls",
      "status": "success",
      "startedAt": "2026-04-06T14:00:05.000Z",
      "finishedAt": "2026-04-06T14:00:08.000Z"
    }
  ]
}
```

Approved terminal statuses:

- `success`
- `partial_success`
- `failed`

## Security And Validation

### Authentication

Add a new environment variable:

- `INTERNAL_JOB_KEY`

The internal jobs endpoint must compare the incoming `X-Job-Key` header against that value.

Because the backend uses centralized environment validation, this slice must also:

- add `INTERNAL_JOB_KEY` to `envSchema`
- add `INTERNAL_JOB_KEY` to `.env.example`
- fail application startup when `INTERNAL_JOB_KEY` is missing or blank

Approved rules:

- missing key fails the request before any refresh runs
- invalid key fails the request before any refresh runs
- the key is global per environment, not per tenant
- the key must stay server-side and never be exposed to the frontend

### Request validation

Approved rules:

- `slug` must be present and non-empty
- `from` and `to` must be present and valid using the same date semantics already used by existing KPI refresh flows
- any unexpected query parameter returns `400`
- invalid date input returns `400`
- unknown slug returns `404`
- inactive tenant returns `404`
- tenant without `backendClientId` must fail before execution starts
- tenant with inactive backend client must fail before execution starts

### HTTP status rules

Approved rules:

- return `200` when the request was authenticated and the job ran, even if one or more refreshes fail
- return `400` for invalid query input
- return `401` or `403` for missing or invalid job key
- return `404` for unknown or inactive tenant slug
- return `409` for tenant configuration errors after slug resolution, including missing `backendClientId` or inactive backend client

## Tenant Resolution Strategy

The automation endpoint must resolve the target tenant without requiring a user membership context.

Approved lookup behavior:

- read the tenant directly by `slug`
- require the tenant to be active
- require `backendClientId` to be present
- require the linked backend client to be active

This flow is intentionally separate from the current `UserMembershipService.resolveActiveScope` path because it is not tied to a user or membership.

The implementation must add a dedicated machine-job tenant resolver or repository path for lookup by `slug`. This is required work, not optional reuse, because the current auth services only resolve tenant scope through user membership and tenant id.

## Orchestration Strategy

Create a dedicated application service responsible for the internal job flow.

Recommended responsibilities:

- validate the incoming job key
- resolve the tenant and backend client from `slug`
- invoke the existing refresh services with the resolved `clientId`
- capture timing and success or failure for each refresh family
- compute `overallStatus`
- return the execution summary

Execution order must stay:

1. `budgets`
2. `sales`
3. `calls`

Reasoning:

- `sales` already depends conceptually on budget-linked enrichment
- `calls` also compares call activity against budget-derived telemarketing context
- sequential ordering reduces accidental refresh skew across related KPI families

## Failure Handling

Each refresh family must execute inside an isolated error boundary.

Approved behavior:

- a failure in `budgets` must not prevent `sales` or `calls`
- a failure in `sales` must not prevent `calls`
- the final response must include an `error` message for each failed step
- `overallStatus = success` when all steps succeed
- `overallStatus = partial_success` when at least one step succeeds and at least one fails
- `overallStatus = failed` when all steps fail

The endpoint should favor observability over fail-fast behavior once the request has passed structural validation.

## Logging

Use server-side logs for operational visibility.

The implementation should log at least:

- job start with `slug`, `clientId`, `from`, and `to`
- start and finish of each refresh family
- per-family failure message
- final overall status

The HTTP response should remain compact and machine-friendly.

## Recommended Code Shape

### Presentation layer

Add a dedicated controller for internal job routes.

Recommended route ownership:

- `POST /internal/jobs/kpis/refresh`

The controller should only:

- read `X-Job-Key`
- parse `slug`, `from`, and `to`
- delegate to the orchestration service

### Application layer

Add a dedicated orchestration service, for example:

- `InternalKpiRefreshJobService`

Add a dedicated tenant resolver abstraction or service for machine-job lookup by `slug`.

Recommended responsibilities for that resolver:

- load tenant by unique `slug`
- reject inactive tenants
- reject tenants without `backendClientId`
- reject tenants whose linked backend client is inactive

### Infrastructure layer

Add repository support for:

- resolving an active tenant by `slug`
- confirming that the linked backend client is active

Reuse the existing KPI refresh services directly instead of issuing internal HTTP calls to the public controllers.

## Testing Strategy

Required coverage:

- parser tests for `slug`, `from`, and `to`
- parser tests proving unexpected query parameters are rejected
- controller tests proving:
  - valid `X-Job-Key` reaches the service
  - missing or invalid key is rejected
  - parsed query values reach the service correctly
- service tests proving:
  - tenant resolution rejects unknown slugs
  - tenant resolution rejects inactive tenants
  - tenant resolution rejects tenants without `backendClientId`
  - tenant resolution rejects tenants without active backend clients
  - `budgets`, `sales`, and `calls` run in the approved order
  - the service continues after an individual refresh failure
  - `overallStatus` is computed correctly for full success, partial success, and total failure

## Documentation Updates

Update the backend documentation to include:

- `POST /internal/jobs/kpis/refresh`
- required `X-Job-Key` header
- required `slug`, `from`, and `to`
- response semantics for `overallStatus` and `results`

The documentation should explicitly say:

- this endpoint is intended for backend automation only
- it does not use JWT authentication
- it refreshes `budgets`, `sales`, and `calls`
- it resolves tenant scope by slug internally
