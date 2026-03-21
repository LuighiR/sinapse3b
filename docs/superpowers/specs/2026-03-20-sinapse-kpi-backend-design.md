# Sinapse KPI Backend Design

Date: 2026-03-20
Project: Sinapse KPI backend
Status: Approved in conversation, revised after written spec review

## Goal

Build a multi-tenant backend focused on KPI generation for multiple companies. The system will not own external imports. Raw data is loaded by other integration processes, and this backend is responsible for:

- organizing and normalizing business data
- applying business rules
- calculating KPIs
- persisting KPI outputs and audit trails
- serving data to the frontend dashboard

The dashboard should primarily display closed data for D-1. Users will generally see data up to yesterday, refreshed in a daily batch. Some drill-down views may read live detail when the source data is already reliable and query cost is low.

## Product Context

The product has a frontend application responsible for login/session handling and dashboard rendering. The KPI backend is a separate backend focused on analytics and KPI delivery.

Known data families:

- WhatsApp conversational data in `core`
- budgets in `raws.ferraco_budgets`
- calls in `raws.ferraco_calls`
- sales in `raws.ferraco_sales`

Known KPI families from the provided design:

- budgets
- sales
- calls
- WhatsApp
- follow-up
- cross-channel conversion and ranking views

These KPI families require combining multiple domains while keeping formulas globally consistent across tenants. Some tenants may not have enough source data for a given KPI, so KPI availability must be tenant-aware.

## Architecture Decision

Use a modular monolith backend with background jobs, designed so heavy processors can be extracted later if needed.

Reasons:

- domain rules are still being consolidated
- multi-service distributed architecture would add early operational cost
- daily batch processing reduces the need for real-time distributed orchestration
- modular boundaries inside one codebase are enough to achieve low coupling now

Initial deploy units:

- API service
- worker service
- PostgreSQL database
- optional Redis only if queue pressure justifies it later

## Stack

Recommended stack:

- TypeScript
- NestJS
- PostgreSQL
- Prisma for operational persistence and migrations
- direct SQL for analytical and reporting queries
- `pg-boss` for daily jobs and reprocessing queues
- OpenAPI/Swagger
- structured logging and error monitoring

## Data Layering

The official schemas are:

- `raws`: raw source data
- `core`: canonical business domain
- `kpi`: KPI outputs, snapshots, breakdowns, runs, audit references

The `public` schema must be ignored as legacy/noise and should not be used by new services.

### `raws`

Responsibilities:

- preserve source-oriented records close to the original payload
- support replay and reprocessing
- isolate source-specific variations between tenants and integrations

Rules:

- no dashboard should read directly from `raws`
- KPI rules should not depend on raw source quirks
- all raw tables must carry tenant ownership explicitly, directly or through a reliable join path

### `core`

Responsibilities:

- hold the canonical business model used by analytics and dashboard logic
- standardize cross-channel concepts
- absorb normalization from `raws`

Current relevant entities in `core`:

- `tenants`
- `users`
- `memberships`
- `sinapse_clients`
- `branches`
- `employees`
- `contacts`
- `contact_extra_info`
- `tags`
- `contact_tags`
- `tickets`
- `imported_trackings`
- `sessions`
- `messages`

### `kpi`

Responsibilities:

- store materialized KPI outputs
- store breakdowns and series for drill-down
- store execution/audit metadata
- support fast, stable frontend responses

Initial expected tables:

- `kpi.definitions`
- `kpi.availability`
- `kpi.snapshots`
- `kpi.breakdowns`
- `kpi.calculation_runs`
- `kpi.drilldown_refs`

Exact table design can be refined in implementation planning.

## Multi-Tenant Access Model

The product separates account access from backend operational data.

Access path:

`user -> membership -> tenant -> backend_client_id -> sinapse_client`

Interpretation:

- `core.users` stores system users
- `core.memberships` defines which tenants a user can access and with what role
- `core.tenants` is the tenant/account visible in the product
- `core.tenants.backend_client_id` maps a product tenant to the backend operational company
- `core.sinapse_clients` is the operational company used by KPI and domain data

This separation is intentional and should remain the foundation of authorization.

## Authentication and Authorization

The frontend application is expected to handle login/session UX. The KPI backend should focus on authorization and tenant resolution.

### Security contract

The frontend product in Next.js is the authentication authority for this system and will issue the JWT consumed by this backend on every authenticated request.

The KPI backend must:

- validate the JWT signature
- validate token expiration and issuer/audience rules
- extract the authenticated user identity from the token
- never trust user identity from plain headers or request body

Approved trust model:

- Next.js signs the JWT
- the KPI backend validates the JWT using the shared signing configuration agreed between both services
- the KPI backend does not issue login tokens
- the KPI backend treats the JWT as the only trusted proof of user identity

The preferred contract is:

- the JWT identifies the user
- the active tenant is sent separately by the frontend as request context, not embedded as a permanent login choice

This avoids reissuing tokens every time a user switches tenants inside the product.

Recommended flow:

1. User authenticates through the frontend product flow.
2. The frontend sends the JWT to the KPI backend in authenticated requests.
3. The KPI backend resolves the authenticated user.
4. The KPI backend loads active memberships for the user.
5. The frontend sends the active tenant id for the current request.
6. The backend validates that the user has an active membership for that tenant.
7. The backend resolves `tenant.backend_client_id`.
8. All domain and KPI reads are scoped by the resolved `client_id`.

### Active tenant selection

The active tenant is a frontend-controlled request context.

Recommended first implementation:

- frontend stores the selected tenant in its own session or UI state
- every backend request sends the selected tenant id in a dedicated header such as `X-Tenant-Id`
- backend verifies that the authenticated user has an active membership for that tenant
- backend resolves the backend client from that tenant on every request or through a scoped request cache

This keeps tenant switching simple and explicit.

Important constraints:

- JWT validation is mandatory on every authenticated request
- membership must be active
- tenant must be active
- backend client must be active
- the selected tenant must belong to the authenticated user
- all filters must be validated inside the resolved client scope

## Initial KPI Source Model

Although the first implementation slice starts with auth and company structure, the KPI source contract should already be fixed to avoid ambiguity later.

For KPI families backed by raw ERP or telephony data, the KPI engine must not read directly from `raws`.

Approved source path:

- `raws.ferraco_budgets` -> normalized into `core.budget_facts`
- `raws.ferraco_sales` -> normalized into `core.sale_facts`
- `raws.ferraco_calls` -> normalized into `core.call_facts`
- WhatsApp conversational KPIs read from canonical `core` entities such as `tickets`, `imported_trackings`, `sessions`, `messages`, `contacts`, and tags

This means the first KPI engine reads from:

- `core.budget_facts`
- `core.sale_facts`
- `core.call_facts`
- canonical conversational entities in `core`

The exact DDL for these fact tables can be finalized in implementation planning, but their existence is now part of the design.

## Company and Organization Model

Current company-related entities:

- `core.tenants`
- `core.sinapse_clients`
- `core.branches`
- `core.employees`

Current relationships:

- `tenants.backend_client_id -> sinapse_clients.id`
- `branches.client_id -> sinapse_clients.id`

### Adjustment approved for implementation

Add `branch_id` to `core.employees`.

Rationale:

- employees belong operationally to a branch
- branch already links to `client_id`
- client ownership for employees can be resolved by `employee -> branch -> client`
- this reduces duplication and keeps branch as the local organizational anchor

No separate `client_id` column is required on `employees` in the first implementation if every employee belongs to exactly one branch.

Scope enforcement for organizational entities must happen in two layers:

- database constraints for structural relationships such as `employees.branch_id -> branches.id`
- service-layer authorization checks to confirm that every requested branch or employee belongs to the resolved active client

## Backend Module Design

Recommended NestJS module boundaries:

- `auth`
- `clients`
- `core-domain`
- `normalization`
- `kpi-engine`
- `kpi-query`
- `drilldown`
- `jobs`
- `ai-analysis`

### `auth`

Responsibilities:

- resolve authenticated user context
- resolve active tenant
- resolve backend client scope
- enforce tenant membership access

### `clients`

Responsibilities:

- read company, branch, and employee structures
- expose tenant/company metadata needed by the frontend

### `core-domain`

Responsibilities:

- encapsulate access to canonical entities in `core`
- provide reusable domain queries for sessions, contacts, tags, branches, employees, and operational relationships

### `normalization`

Responsibilities:

- transform `raws` data into canonical `core` facts
- be the only layer that deeply understands raw source formats

### `kpi-engine`

Responsibilities:

- apply KPI formulas
- calculate daily snapshots
- build breakdowns and ranking views
- mark KPI availability per tenant

### `kpi-query`

Responsibilities:

- serve cards, charts, rankings, and summary widgets to the frontend
- prefer materialized `kpi` data

### `drilldown`

Responsibilities:

- provide day-by-day and filtered detail views
- support seller, branch, channel, tag, and other dimensions
- complement materialized views with `core` reads when live detail is safe and cheap

### `jobs`

Responsibilities:

- schedule and run daily D-1 processing
- support backfill and reprocessing
- record execution status and versioning

### `ai-analysis`

Responsibilities:

- run heavy session analysis tasks
- persist analysis outputs for later KPI use

## Data Processing Strategy

The system will use a hybrid read strategy.

### Materialized reads

Use `kpi` snapshots and breakdowns for:

- dashboard cards
- pre-aggregated time series
- cross-channel KPIs
- expensive monthly summaries
- calculations involving heavy joins or AI outputs

### Live reads

Use `core` or trusted near-ready operational tables for:

- drill-down modals
- day-by-day detail
- filtered views by seller, branch, or channel when the query is simple and auditable

This means the dashboard can show a monthly card from `kpi.snapshots`, then open a modal backed by day-level detail from `core` or pre-normalized facts.

## Refresh Model

Primary refresh model:

- daily batch processing after the day closes
- the dashboard defaults to data up to D-1

This is acceptable because users do not need real-time data for the current day.

Benefits:

- simpler operations
- stable numbers
- easier auditability
- easier reprocessing when rules change

## KPI Auditability

Auditability is a hard requirement.

Users must be able to click a KPI card and inspect:

- the day-by-day composition for the selected period
- filters such as seller and branch
- the rule or formula version used
- the records or aggregates that explain the value

Design implications:

- KPI outputs must store execution metadata
- breakdowns must be persisted or reproducible
- the backend must keep drill-down references or reproducible query definitions
- formula versioning must be explicit in the calculation run

## Initial API Surface

The first implementation phase should focus on auth context and company structure before KPI delivery.

Initial endpoints:

- `GET /me`
- `GET /me/tenants`
- `GET /auth/context`
- `GET /companies/current`
- `GET /companies/current/branches`
- `GET /companies/current/employees`

Auth support direction:

- this backend does not own login
- this backend validates JWTs issued by the Next.js frontend
- this backend resolves authorization, tenant scope, and backend client scope

The preferred direction is to keep login in the frontend product flow and use this backend for authorization + tenant/client scoping.

## First Implementation Slice

Implementation should start with:

1. schema adjustment for `core.employees.branch_id`
2. tenant/user/membership authorization flow
3. company and branch read APIs
4. employee read APIs scoped by tenant/client

Why start here:

- it creates the tenant access boundary for everything else
- it gives the frontend the company context it needs early
- it validates the separation between tenant/product and client/backend

## Required Invariants

- every authenticated request resolves exactly one tenant context
- every tenant resolves to exactly one backend client
- every branch belongs to exactly one backend client
- every employee belongs to exactly one branch
- every employee visible through the API is inside the active client scope
- no KPI query can escape the active tenant/client boundary

Enforcement model:

- foreign keys and not-null constraints enforce structural ownership where possible
- unique indexes enforce one-to-one or natural uniqueness assumptions where needed
- request-scoped authorization checks enforce tenant/client visibility before returning any branch, employee, or KPI data

## Risks and Follow-Up

Known follow-up items:

- ensure all `raws` tables have reliable tenant ownership
- create the `kpi` schema and its initial tables
- define canonical KPI dimensions such as seller, branch, channel, day, hour, and tag
- define the exact DDL for `core.budget_facts`, `core.sale_facts`, and `core.call_facts`

## Testing Priorities

First-phase tests should cover:

- resolving authenticated user context
- loading active memberships only
- tenant selection and backend client resolution
- reading current company
- reading branches for the current company
- reading employees for the current company
- rejecting access to data outside the active tenant/client
- rejecting inactive tenant or inactive membership access

## Out of Scope for This Spec Phase

- exact KPI formulas
- detailed AI scoring prompts and storage models
- exact `kpi` table DDL
- import implementations for external data sources
- frontend layout implementation

Those should be handled in later design and planning steps once the auth/company foundation is implemented.
