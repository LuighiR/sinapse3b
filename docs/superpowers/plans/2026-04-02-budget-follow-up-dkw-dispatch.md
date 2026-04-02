# Budget Follow-Up DKW Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual backend endpoint that dispatches budgets classified as `after24h` and `open` to the DKW webhook, marks successful sends in `raw.ferraco_budgets.sent_dkw_at`, and aborts only after three consecutive webhook failures.

**Architecture:** Keep the approved follow-up classifier in `core.budget_facts` as the source of truth for eligibility, but read operational dispatch fields and write the send marker in `raw.ferraco_budgets`. Implement the new behavior as a dedicated application service with a focused Prisma repository and a tiny webhook client abstraction so the flow stays testable without mixing it into the existing read-only KPI query service.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Jest, Supertest, Zod

---

## Planned File Structure

### Config

- Modify: `D:\Projetos\sinapse3\src\config\env.ts`
- Modify: `D:\Projetos\sinapse3\src\config\env.spec.ts`
- Modify: `D:\Projetos\sinapse3\.env.example`

### Application

- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.spec.ts`

### Infrastructure

- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\fetch-budget-follow-up-dkw-webhook.client.ts`

### Presentation

- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-follow-up-dkw-dispatch.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-follow-up-common.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\kpi.controller.ts`

### Wiring, API, And End-To-End

- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-budgets.e2e-spec.ts`
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

## Scope And Slice Boundary

This plan covers only the dispatch flow approved in:

- `D:\Projetos\sinapse3\docs\superpowers\specs\2026-04-02-budget-follow-up-dkw-dispatch-design.md`

In scope:

- new manual dispatch endpoint
- follow-up eligibility reused from the canonical classifier
- raw/core join for payload and send-state handling
- `sent_dkw_at` writeback on success
- phone fallback and optional `mensagem`
- three-consecutive-error abort behavior
- focused tests and docs

Out of scope:

- cron scheduling
- queue workers
- changing existing follow-up endpoints
- schema changes in Prisma for `raw.ferraco_budgets`

## Implementation Decisions Locked In

### Webhook URL configuration

Store the webhook URL in env as:

- `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL`

Reason:

- avoids baking an operational webhook URL directly into source control
- keeps the feature deployable across environments

Use a trimmed string with default `''` so the app still boots in environments that have not enabled this flow yet. The webhook client should throw a clear runtime error if the endpoint is called without the env configured.

### Eligibility source

Eligibility must be computed from `core.budget_facts` with the shared `classifyBudgetFollowUpRecord(...)` helper. The dispatch service must never reimplement the follow-up semantics.

### Operational source of truth

Read and write these fields only from `raw.ferraco_budgets`:

- `email`
- `cell_phone`
- `phone`
- `sent_dkw_at`

### Execution model

Dispatch sequentially, not in parallel.

Reason:

- keeps the consecutive-failure rule straightforward
- makes logging and `sent_dkw_at` updates deterministic

## Task 1: Add Config And Query Parser Support

**Files:**
- Modify: `D:\Projetos\sinapse3\src\config\env.ts`
- Modify: `D:\Projetos\sinapse3\src\config\env.spec.ts`
- Modify: `D:\Projetos\sinapse3\.env.example`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-follow-up-dkw-dispatch.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-follow-up-common.query.spec.ts`

- [ ] **Step 1: Write the failing env and parser tests**

Add an env assertion proving the new variable is parsed with a safe default:

```ts
expect(loadEnv({
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
  AUTH_JWT_SECRET: 'super-secret',
  AUTH_JWT_ISSUER: 'sinapse3',
  AUTH_JWT_AUDIENCE: 'sinapse3-web',
})).toMatchObject({
  BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL: '',
})
```

Extend `budget-follow-up-common.query.spec.ts` with parser coverage for the new dispatch parser:

```ts
import { parseBudgetFollowUpDkwDispatchQuery } from './budget-follow-up-dkw-dispatch.query'

it('parses the budget follow-up dkw dispatch query', () => {
  expect(
    parseBudgetFollowUpDkwDispatchQuery({
      from: '2026-04-01',
      to: '2026-04-02',
      referenceAt: '2026-04-02T10:00',
      sellerId: '7',
      branchId: '5',
      orderType: '  Balcao  ',
    }),
  ).toEqual({
    from: '2026-04-01',
    to: '2026-04-02',
    referenceAt: '2026-04-02T10:00',
    sellerId: 7,
    branchId: 5,
    orderType: 'Balcao',
  })
})
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- --runInBand src/config/env.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`

Expected: FAIL because the env schema and parser file are not updated yet.

- [ ] **Step 3: Implement the minimal env and parser support**

In `env.ts`:

- add `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL: z.string().default('').transform((value) => value.trim())`

In `.env.example`:

- add `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL=`

In `budget-follow-up-dkw-dispatch.query.ts`:

- reuse `budgetFollowUpSummaryQuerySchema`
- reuse `parseBudgetFollowUpQuery(...)`
- return the same parsed shape as the existing follow-up summary filters

Recommended parser implementation:

```ts
import {
  budgetFollowUpSummaryQuerySchema,
  parseBudgetFollowUpQuery,
  type BudgetFollowUpSummaryQuery,
} from './budget-follow-up-common.query'

export function parseBudgetFollowUpDkwDispatchQuery(
  query: Record<string, unknown>,
): BudgetFollowUpSummaryQuery {
  return parseBudgetFollowUpQuery(
    query,
    'Invalid budget follow-up DKW dispatch query params',
    budgetFollowUpSummaryQuerySchema,
  )
}
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- --runInBand src/config/env.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/config/env.spec.ts .env.example src/modules/kpi/presentation/query/budget-follow-up-dkw-dispatch.query.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts
git commit -m "feat: add dkw dispatch config and query parser"
```

## Task 2: Add The Dispatch Service Contract With TDD

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Cover the core business behavior with mocked repository and mocked webhook client:

```ts
it('sends only rows classified as after24h open and marks them as sent', async () => {
  repository.listDispatchCandidates.mockResolvedValue([
    makeCandidate({
      rawBudgetId: 10,
      sentDkwAt: null,
      statusNormalized: 'OPEN',
      budgetDatetime: '2026-04-01T08:00:00.000Z',
    }),
  ])

  await service.dispatch({
    clientId: 'client-1',
    from: '2026-04-01',
    to: '2026-04-02',
    referenceAt: '2026-04-02T10:00:00-03:00',
  })

  expect(webhook.sendLead).toHaveBeenCalledWith(expect.objectContaining({
    name: 'ACME LTDA',
    phone: '5551999999999',
  }))
  expect(repository.markAsSent).toHaveBeenCalledWith({
    rawBudgetId: 10,
    sentAt: expect.any(Date),
  })
})

it('uses phone fallback and mensagem when both phones are missing', async () => {
  repository.listDispatchCandidates.mockResolvedValue([
    makeCandidate({
      cellPhone: null,
      phone: null,
      sentDkwAt: null,
    }),
  ])

  await service.dispatch(validInput)

  expect(webhook.sendLead).toHaveBeenCalledWith(expect.objectContaining({
    phone: 'Sem registro',
    mensagem: 'Sem telefone registrado',
  }))
})

it('skips rows already sent in raw', async () => {
  repository.listDispatchCandidates.mockResolvedValue([
    makeCandidate({
      rawBudgetId: 20,
      sentDkwAt: '2026-04-02T09:00:00.000Z',
    }),
  ])

  await service.dispatch(validInput)

  expect(webhook.sendLead).not.toHaveBeenCalled()
  expect(repository.markAsSent).not.toHaveBeenCalled()
})

it('aborts after three consecutive webhook failures', async () => {
  repository.listDispatchCandidates.mockResolvedValue([
    makeCandidate({ rawBudgetId: 1, sentDkwAt: null }),
    makeCandidate({ rawBudgetId: 2, sentDkwAt: null }),
    makeCandidate({ rawBudgetId: 3, sentDkwAt: null }),
    makeCandidate({ rawBudgetId: 4, sentDkwAt: null }),
  ])
  webhook.sendLead.mockRejectedValue(new Error('boom'))

  const result = await service.dispatch(validInput)

  expect(result.status).toBe('aborted_after_consecutive_errors')
  expect(webhook.sendLead).toHaveBeenCalledTimes(3)
})

it('resets the consecutive failure counter after a success', async () => {
  repository.listDispatchCandidates.mockResolvedValue([
    makeCandidate({ rawBudgetId: 1, sentDkwAt: null }),
    makeCandidate({ rawBudgetId: 2, sentDkwAt: null }),
    makeCandidate({ rawBudgetId: 3, sentDkwAt: null }),
  ])
  webhook.sendLead
    .mockRejectedValueOnce(new Error('first'))
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('third'))

  const result = await service.dispatch(validInput)

  expect(result.status).toBe('completed')
})
```

- [ ] **Step 2: Run the service spec to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-dkw-dispatch.service.spec.ts`

Expected: FAIL because the service file does not exist yet.

- [ ] **Step 3: Implement the minimal dispatch service**

Define:

- `BudgetFollowUpDkwDispatchInput`
- `BudgetFollowUpDkwDispatchResponse`
- `BudgetFollowUpDkwDispatchCandidate`
- repository and webhook-client interfaces

Implementation rules:

- parse `referenceAt` with the same Sao Paulo-aware semantics already used by `BudgetKpiQueryService`
- reuse `classifyBudgetFollowUpRecord(...)`
- skip anything not classified as `after24h + open`
- skip anything with `sentDkwAt !== null`
- build the payload with the approved fallback rules
- send sequentially
- call `markAsSent(...)` only after `sendLead(...)` succeeds
- return only `period`, `referenceAt`, and terminal `status`

Recommended payload builder:

```ts
private toWebhookPayload(row: BudgetFollowUpDkwDispatchCandidate): BudgetFollowUpDkwWebhookPayload {
  const resolvedPhone = firstNonBlank(row.cellPhone, row.phone) ?? 'Sem registro'
  const missingPhone = resolvedPhone === 'Sem registro'

  return {
    name: row.customerName,
    email: row.email,
    phone: resolvedPhone,
    valor_orcamento: row.valueAmount,
    codigo_dav: String(row.davId),
    vendedor: row.sellerName,
    data_hora_abertura: row.openingDatetime,
    ...(missingPhone ? { mensagem: 'Sem telefone registrado' } : {}),
  }
}
```

- [ ] **Step 4: Run the service spec to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-dkw-dispatch.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-follow-up-dkw-dispatch.service.ts src/modules/kpi/application/budget-follow-up-dkw-dispatch.service.spec.ts
git commit -m "feat: add budget follow-up dkw dispatch service"
```

## Task 3: Add The Prisma Repository And Webhook Client

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\fetch-budget-follow-up-dkw-webhook.client.ts`

- [ ] **Step 1: Write the failing repository spec**

Add tests that verify:

- the candidate query applies `clientId`, `from`, `to`, optional `sellerId`, and optional `branchId`
- the query joins `core.budget_facts` to `raw.ferraco_budgets`
- `markAsSent(...)` updates `raw.ferraco_budgets.sent_dkw_at`

Representative assertions:

```ts
await repository.listDispatchCandidates({
  clientId: 'ferracosul',
  period: KpiPeriod.between({ from: '2026-04-01', to: '2026-04-02' }),
  sellerId: 7,
  branchId: 5,
})

expect(prisma.$queryRaw).toHaveBeenCalled()

await repository.markAsSent({
  rawBudgetId: 123,
  sentAt: new Date('2026-04-02T12:00:00.000Z'),
})

expect(prisma.$executeRaw).toHaveBeenCalled()
```

- [ ] **Step 2: Run the repository spec to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`

Expected: FAIL because the repository file does not exist yet.

- [ ] **Step 3: Implement the Prisma repository and webhook client**

Repository responsibilities:

- query joined rows from `core.budget_facts` and `raw.ferraco_budgets`
- return the fields needed by the service for classification and payload mapping
- update `raw.ferraco_budgets.sent_dkw_at`

Recommended candidate query shape:

```sql
SELECT
  fact.client_id AS "clientId",
  fact.branch_id AS "branchId",
  fact.seller_id AS "sellerId",
  fact.status_normalized AS "statusNormalized",
  fact.budget_datetime AS "budgetDatetime",
  fact.closing_date AS "closingDate",
  fact.cancellation_date AS "cancellationDate",
  fact.cancelation_time AS "cancelationTime",
  fact.payload_json AS "payloadJson",
  raw.id AS "rawBudgetId",
  raw.customer_name AS "customerName",
  raw.email,
  raw.cell_phone AS "cellPhone",
  raw.phone,
  raw.value::text AS "valueAmount",
  raw.dav_id::text AS "davId",
  raw.seller_name AS "sellerName",
  (raw.opening_date::timestamp + COALESCE(raw.opening_time, time '00:00:00'))::text AS "openingDatetime",
  raw.sent_dkw_at AS "sentDkwAt"
FROM core.budget_facts AS fact
JOIN raw.ferraco_budgets AS raw
  ON raw.id = fact.source_record_id
WHERE fact.client_id = $1
  AND fact.source_table = 'raw.ferraco_budgets'
  AND fact.budget_date BETWEEN $2 AND $3
```

Webhook client responsibilities:

- read `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL` from `loadEnv()`
- `fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`
- throw on non-2xx responses with a small error message that includes the status code

- [ ] **Step 4: Run the repository spec to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.ts src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts src/modules/kpi/infrastructure/fetch-budget-follow-up-dkw-webhook.client.ts
git commit -m "feat: add dkw dispatch prisma repository"
```

## Task 4: Wire The Controller And Module

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\kpi.controller.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`

- [ ] **Step 1: Write the failing controller/e2e tests**

Extend `test/kpi-budgets.e2e-spec.ts` with:

- one success case for `POST /kpis/budgets/follow-up/dkw-dispatch`
- one `400` case when `referenceAt` is missing
- one assertion that the controller passes parsed filters to the service

Representative test:

```ts
it('dispatches budget follow-up dkw rows for the active tenant client', async () => {
  await request(app.getHttpServer())
    .post('/kpis/budgets/follow-up/dkw-dispatch')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', 'tenant-1')
    .query({
      from: '2026-04-01',
      to: '2026-04-02',
      referenceAt: '2026-04-02T10:00:00-03:00',
      sellerId: '7',
      branchId: '5',
      orderType: 'Balcao',
    })
    .expect(200)

  expect(dispatchService.dispatch).toHaveBeenCalledWith({
    clientId: 'client-1',
    from: '2026-04-01',
    to: '2026-04-02',
    referenceAt: '2026-04-02T10:00:00-03:00',
    sellerId: 7,
    branchId: 5,
    orderType: 'Balcao',
  })
})
```

- [ ] **Step 2: Run the e2e spec to verify it fails**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "dkw"`

Expected: FAIL because the service is not wired into the controller yet.

- [ ] **Step 3: Implement the controller and module wiring**

In `kpi.controller.ts`:

- add `@Post('follow-up/dkw-dispatch')`
- parse with `parseBudgetFollowUpDkwDispatchQuery(...)`
- forward only `clientId` plus parsed filters to the new service

In `kpi.module.ts`:

- register the new Prisma repository provider
- register the new webhook client provider
- register the new dispatch service provider

Recommended provider shape:

```ts
{
  provide: BudgetFollowUpDkwDispatchService,
  useFactory: (
    repository: PrismaBudgetFollowUpDkwDispatchRepository,
    webhookClient: FetchBudgetFollowUpDkwWebhookClient,
    branchScopeService: BranchScopeService,
  ) => new BudgetFollowUpDkwDispatchService(repository, webhookClient, branchScopeService),
  inject: [PrismaBudgetFollowUpDkwDispatchRepository, FetchBudgetFollowUpDkwWebhookClient, BranchScopeService],
}
```

- [ ] **Step 4: Run the e2e spec to verify it passes**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "dkw"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/presentation/kpi.controller.ts src/modules/kpi/kpi.module.ts test/kpi-budgets.e2e-spec.ts
git commit -m "feat: wire budget follow-up dkw dispatch endpoint"
```

## Task 5: Update REST Docs And Run Focused Verification

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Verify the REST docs do not already contain the route**

Run: `Select-String -Path 'docs\\api\\rest-api.md' -Pattern 'POST /kpis/budgets/follow-up/dkw-dispatch'`

Expected: no output before the doc update.

- [ ] **Step 2: Document the new endpoint**

Add a new section for:

- `POST /kpis/budgets/follow-up/dkw-dispatch`

Document explicitly:

- required query params
- reuse of the existing follow-up classification semantics
- only `after24h + open` budgets are dispatched
- send state is controlled by `raw.ferraco_budgets.sent_dkw_at`
- phone fallback and `mensagem` behavior
- compact response shape

- [ ] **Step 3: Run focused verification for the whole slice**

Run:

```bash
npm test -- --runInBand src/config/env.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts src/modules/kpi/application/budget-follow-up-dkw-dispatch.service.spec.ts src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts test/kpi-budgets.e2e-spec.ts
```

Expected: PASS

Run:

```bash
Select-String -Path 'docs\\api\\rest-api.md' -Pattern 'POST /kpis/budgets/follow-up/dkw-dispatch'
```

Expected: the new heading is found.

- [ ] **Step 4: Commit**

```bash
git add docs/api/rest-api.md
git commit -m "docs: add budget follow-up dkw dispatch api docs"
```
