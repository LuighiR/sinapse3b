# KPI Budget Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first KPI slice on top of the auth/company foundation: normalize raw budget data into `core.budget_facts`, create the initial `kpi` schema foundation, seed the first operational client when needed, calculate the first budget KPIs, and expose frontend-ready endpoints for summary, daily series, and drill-down.

**Architecture:** Keep the existing modular NestJS structure and add a focused `kpi` module plus a small `normalization` slice for budget data. Use SQL migrations for schema changes, Prisma models for the new operational/meta tables we need immediately, and direct SQL or Prisma-backed services for budget fact queries and KPI materialization.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Jest, Supertest, Zod

---

## Planned File Structure

### Prisma and Database

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260321_create_core_budget_facts_and_kpi_foundation.sql`

### Normalization

- Create: `src/modules/normalization/normalization.module.ts`
- Create: `src/modules/normalization/application/budget-normalization.service.ts`
- Create: `src/modules/normalization/application/budget-status.mapper.ts`
- Create: `src/modules/normalization/application/budget-normalization.service.spec.ts`

### KPI Domain and Application

- Create: `src/modules/kpi/kpi.module.ts`
- Create: `src/modules/kpi/domain/kpi-period.ts`
- Create: `src/modules/kpi/application/budget-kpi-refresh.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-availability.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
- Create: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

### KPI Presentation

- Create: `src/modules/kpi/presentation/kpi.controller.ts`
- Create: `src/modules/kpi/presentation/query/budget-summary.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-daily.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-drilldown.query.ts`

### Tests

- Create: `test/kpi-budgets.e2e-spec.ts`

## Scope and Slice Boundary

This slice intentionally covers only the first KPI family: `budgets`.

In scope:

- `raw.ferraco_budgets -> core.budget_facts`
- first `kpi` schema tables needed for budget KPIs
- budget summary KPI
- budget daily breakdown KPI
- budget drill-down by seller/branch/day
- tenant-aware KPI availability for budgets

Out of scope for this slice:

- sales KPI
- calls KPI
- WhatsApp/session KPI
- scheduled nightly jobs
- generic KPI definition engine for every family
- admin CRUD for KPI definitions

## Data Model Decisions For This Slice

### `core.budget_facts`

Create a canonical fact table for budgets in `core` with one row per normalized budget record.

Recommended fields:

- `id`
- `client_id`
- `source_table`
- `source_record_id`
- `branch_name`
- `branch_id` nullable at first if reliable branch mapping does not exist yet
- `seller_id`
- `seller_name`
- `budget_date`
- `budget_datetime`
- `closing_date` nullable
- `status_raw`
- `status_normalized`
- `channel` nullable
- `customer_name`
- `cpf_cnpj`
- `value_amount`
- `sequential`
- `dav_id`
- `sequential_linked_sale`
- `payload_json`
- `created_at`
- `updated_at`

### `raw.ferraco_budgets`

Add `client_id` to the raw table in this slice.

Reason:

- even though `ferraco_budgets` currently belongs only to Ferracosul, raw ownership should be explicit instead of hidden in application assumptions
- the importer can write a fixed Ferracosul `client_id`
- future reprocessing and auditability become simpler

### `core.sinapse_clients`

Seed the first operational client for Ferracosul in this slice if the target database still has no `core.sinapse_clients` rows.

Reason:

- the auth/company foundation already depends on `tenant.backend_client_id -> sinapse_client`
- the budget normalization and KPI refresh flow need a real `client_id` to attach raw and core budget rows
- the current `sinapse-new` database is empty in `core.sinapse_clients`

Normalization rule:

- `client_id` must be provided explicitly by the resolved active tenant context during refresh execution
- the normalization service must never infer or guess client ownership from ambient defaults
- the manual refresh endpoint must operate only on the resolved `clientId` from the authenticated request
- branch matching may use branch name only when the match is unique inside the active client scope; otherwise keep `branch_id` null and preserve `branch_name` for auditability

### `kpi` schema tables for this slice

Create the smallest useful foundation:

- `kpi.definitions`
- `kpi.availability`
- `kpi.snapshots`
- `kpi.breakdowns`
- `kpi.calculation_runs`
- `kpi.drilldown_refs`

Minimum purpose:

- `definitions`: identify budget KPIs like `budgets.summary`, `budgets.daily`, `budgets.drilldown`
- `availability`: whether a client can use the budget KPI family
- `snapshots`: materialized summary values for period + client
- `breakdowns`: day-level, seller-level, and branch-level breakdowns
- `calculation_runs`: audit every refresh execution
- `drilldown_refs`: preserve the audit trail from materialized KPI values to normalized facts or reproducible filter references used by the drill-down

Do not overgeneralize beyond the budget slice.

## API Contracts For This Slice

Implement these endpoints behind the existing auth + tenant context:

- `POST /kpis/budgets/refresh`
- `GET /kpis/budgets/summary`
- `GET /kpis/budgets/daily`
- `GET /kpis/budgets/drilldown`

Recommended query contracts:

- `GET /kpis/budgets/summary?from=2026-01-01&to=2026-01-31`
- `GET /kpis/budgets/daily?from=2026-01-01&to=2026-01-31`
- `GET /kpis/budgets/drilldown?from=2026-01-01&to=2026-01-31&sellerId=123&branchName=Matriz`

For this first slice, `POST /kpis/budgets/refresh` can be an authenticated manual refresh endpoint. That is good enough before scheduled jobs are introduced.

## Task 1: Add Budget Fact And KPI Foundation Migrations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260321_create_core_budget_facts_and_kpi_foundation.sql`

- [ ] **Step 1: Write the failing schema test**

Use a focused validation test that asserts the Prisma schema contains the new models needed for this slice.

```ts
import { readFileSync } from 'node:fs'

describe('prisma schema', () => {
  it('models core budget facts and the first kpi tables', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf-8')

    expect(schema).toContain('model BudgetFact')
    expect(schema).toContain('@@schema("core")')
    expect(schema).toContain('model KpiSnapshot')
    expect(schema).toContain('@@schema("kpi")')
  })
})
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `npm test -- --runInBand prisma/schema.spec.ts`
Expected: FAIL because the new models do not exist yet.

- [ ] **Step 3: Add Prisma models and SQL migration**

Model at minimum:

- `BudgetFact`
- `KpiDefinition`
- `KpiAvailability`
- `KpiSnapshot`
- `KpiBreakdown`
- `KpiCalculationRun`
- `KpiDrilldownRef`

Use `@@schema("core")` and `@@schema("kpi")` where appropriate.

Before adding those models, update the Prisma datasource so the current Prisma setup supports PostgreSQL multi-schema for this slice.

Example direction:

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["core", "kpi"]
}
```

Adjust the exact datasource configuration to match the Prisma version already used in this repository.

Migration responsibilities:

- add `raw.ferraco_budgets.client_id`
- seed or upsert the first Ferracosul row in `core.sinapse_clients`
 - create `core.budget_facts`
- create `kpi` schema if absent
- create initial `kpi` tables and indexes

For the raw budget ownership change:

- add `client_id` as nullable first if the live database still has existing rows without that value
- backfill existing Ferracosul rows when the target `sinapse_client.id` is known
- make `client_id` required in a safe follow-up step once existing data and importer writes are aligned

For the initial client seed:

- insert or upsert a Ferracosul `core.sinapse_clients` row with a stable `id`, `slug`, and `name`
- document the chosen seed values directly in the migration so later importer code can reuse them

- [ ] **Step 4: Validate Prisma and execute the migration**

Run: `npx prisma validate`
Expected: PASS

Run: `npx prisma db execute --file prisma/migrations/20260321_create_core_budget_facts_and_kpi_foundation.sql`
Expected: PASS against the target database

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260321_create_core_budget_facts_and_kpi_foundation.sql prisma/schema.spec.ts
git commit -m "feat: add budget fact and kpi foundation schema"
```

## Task 2: Normalize Raw Budgets Into `core.budget_facts`

**Files:**
- Create: `src/modules/normalization/normalization.module.ts`
- Create: `src/modules/normalization/application/budget-normalization.service.ts`
- Create: `src/modules/normalization/application/budget-status.mapper.ts`
- Create: `src/modules/normalization/application/budget-normalization.service.spec.ts`

- [ ] **Step 1: Write the failing normalization test**

```ts
describe('BudgetNormalizationService', () => {
  it('maps a raw ferraco budget into a canonical budget fact', async () => {
    const result = normalize({
      status: 'Fechado',
      seller_name: 'Maria',
      opening_date: '2026-01-10',
      value: '1200.50',
    })

    expect(result.statusNormalized).toBe('WON')
    expect(result.sellerName).toBe('Maria')
    expect(result.valueAmount).toBe('1200.50')
  })
})
```

- [ ] **Step 2: Run the normalization test to verify it fails**

Run: `npm test -- --runInBand src/modules/normalization/application/budget-normalization.service.spec.ts`
Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Implement the minimal normalization flow**

Responsibilities:

- read raw budgets from `raw.ferraco_budgets`
- map raw status to a stable enum/value set such as `OPEN`, `WON`, `LOST`, `UNKNOWN`
- derive `budget_datetime` from date + time
- persist normalized records into `core.budget_facts`
- upsert by `(client_id, source_table, source_record_id)`

Keep the first version simple and Ferraço-specific, but never client-agnostic.

The refresh flow for this slice must be:

1. authenticated request resolves active tenant and `clientId`
2. refresh service receives that exact `clientId`
3. raw rows are selected only where `raw.ferraco_budgets.client_id = resolved clientId`
4. normalization writes `core.budget_facts.client_id = resolved clientId`
5. downstream KPI calculation only reads facts for that same `clientId`

- [ ] **Step 4: Run the normalization tests**

Run: `npm test -- --runInBand src/modules/normalization/application/budget-normalization.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/normalization
git commit -m "feat: normalize raw budgets into core budget facts"
```

## Task 3: Add Budget KPI Refresh Service And Availability Rules

**Files:**
- Create: `src/modules/kpi/kpi.module.ts`
- Create: `src/modules/kpi/domain/kpi-period.ts`
- Create: `src/modules/kpi/application/budget-kpi-refresh.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-availability.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write the failing KPI refresh test**

```ts
describe('BudgetKpiRefreshService', () => {
  it('creates summary snapshots and breakdowns for a client period', async () => {
    const result = await service.refresh({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
    })

    expect(result.snapshotsCreated).toBeGreaterThan(0)
    expect(result.breakdownsCreated).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the refresh test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
Expected: FAIL because the KPI services do not exist yet.

- [ ] **Step 3: Implement budget KPI refresh**

Responsibilities:

- mark budget KPI availability for the client when `core.budget_facts` has usable rows
- create a `kpi.calculation_runs` record
- materialize summary snapshots for:
  - total budgets count/value
  - open budgets count/value
  - won budgets count/value
  - lost budgets count/value
- materialize daily breakdowns for the selected period
- materialize seller breakdowns for drill-down

Use the existing tenant -> client scoping model. The refresh service should operate by `clientId`.

- [ ] **Step 4: Run the KPI refresh tests**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi src/app.module.ts
git commit -m "feat: add budget kpi refresh foundation"
```

## Task 4: Add Budget KPI Query Service

**Files:**
- Create: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Create: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing query tests**

```ts
describe('BudgetKpiQueryService', () => {
  it('returns budget summary cards for a client period', async () => {
    const summary = await service.getSummary({
      clientId: 'c1',
      from: '2026-01-01',
      to: '2026-01-31',
    })

    expect(summary.total.count).toBe(10)
    expect(summary.won.value).toBe('5000.00')
  })
})
```

- [ ] **Step 2: Run the query tests to verify they fail**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts`
Expected: FAIL because the query service does not exist yet.

- [ ] **Step 3: Implement the query service**

Expose methods for:

- `getSummary`
- `getDailySeries`
- `getDrilldown`

For this slice:

- summary reads from `kpi.snapshots`
- daily series reads from `kpi.breakdowns`
- drill-down reads from `core.budget_facts` with optional filters

- [ ] **Step 4: Run the query tests**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts
git commit -m "feat: add budget kpi query service"
```

## Task 5: Expose Budget KPI Endpoints

**Files:**
- Create: `src/modules/kpi/presentation/kpi.controller.ts`
- Create: `src/modules/kpi/presentation/query/budget-summary.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-daily.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-drilldown.query.ts`
- Create: `test/kpi-budgets.e2e-spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write the failing KPI endpoint tests**

```ts
it('returns the budget summary for the active tenant client', async () => {
  await request(app.getHttpServer())
    .get('/kpis/budgets/summary')
    .query({ from: '2026-01-01', to: '2026-01-31' })
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', 't1')
    .expect(200)
})
```

- [ ] **Step 2: Run the KPI endpoint tests to verify they fail**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts`
Expected: FAIL because the controller does not exist yet.

- [ ] **Step 3: Implement the controller and query parsing**

Expose:

- `POST /kpis/budgets/refresh`
- `GET /kpis/budgets/summary`
- `GET /kpis/budgets/daily`
- `GET /kpis/budgets/drilldown`

Rules:

- all routes require the existing auth + tenant guards
- all reads operate on the resolved `clientId`
- invalid date ranges should return `400`
- `branchId` and `sellerId` filters must stay inside the active client scope

- [ ] **Step 4: Run the KPI endpoint tests**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/presentation test/kpi-budgets.e2e-spec.ts src/app.module.ts
git commit -m "feat: expose budget kpi endpoints"
```

## Task 6: Verify The Slice End-To-End

**Files:**
- Modify: `README.md` if needed
- Modify: `.env.example` if needed

- [ ] **Step 1: Document the KPI budget slice if anything changed**

Document:

- whether the manual refresh endpoint exists
- how the slice uses `raw.ferraco_budgets`
- any env variables or operational assumptions added in this slice

- [ ] **Step 2: Run the full verification**

Run: `npm test -- --runInBand`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `npx prisma validate`
Expected: PASS

- [ ] **Step 3: Smoke-test the budget endpoints locally**

Run:

```bash
curl -X POST -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" http://localhost:3000/kpis/budgets/refresh
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/kpis/budgets/summary?from=2026-01-01&to=2026-01-31"
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/kpis/budgets/daily?from=2026-01-01&to=2026-01-31"
curl -H "Authorization: Bearer <jwt>" -H "X-Tenant-Id: <tenant-id>" "http://localhost:3000/kpis/budgets/drilldown?from=2026-01-01&to=2026-01-31&sellerId=123"
```

Expected: authenticated, tenant-scoped responses with stable budget KPI payloads.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs: document budget kpi foundation"
```

## Notes For Execution

- Keep this slice budget-only. Do not pull calls or sales into the same implementation pass.
- Prefer explicit normalized statuses over trying to preserve every raw status nuance in the first version.
- The first refresh endpoint can be manual; scheduled jobs belong to a later slice.
- If branch matching from raw budgets is not reliable yet, preserve `branch_name` and keep `branch_id` nullable in `core.budget_facts` until a safe resolver exists.
- The drill-down endpoint should prioritize auditability and stable filters over heavy optimization.
