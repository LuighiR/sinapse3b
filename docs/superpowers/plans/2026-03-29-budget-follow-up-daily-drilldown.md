# Budget Follow-Up Daily And Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-only budget follow-up daily and drilldown endpoints that share one canonical follow-up classifier with the existing follow-up summary endpoint.

**Architecture:** Keep the current NestJS KPI module shape, but extract the follow-up classification rules into a focused application helper so summary, daily, and drilldown stay aligned. Add small query parser files for the new endpoints, wire the controller routes, extend the budget query service, and cover the behavior with focused unit, parser, and e2e tests.

**Tech Stack:** Node.js, TypeScript, NestJS, Jest, Supertest, Zod

---

## Planned File Structure

### Application

- Create: `src/modules/kpi/application/budget-follow-up-classifier.ts`
- Create: `src/modules/kpi/application/budget-follow-up-classifier.spec.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

### Presentation

- Create: `src/modules/kpi/presentation/query/budget-follow-up-common.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-daily.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-drilldown.query.ts`
- Modify: `src/modules/kpi/presentation/query/budget-follow-up-summary.query.ts`
- Modify: `src/modules/kpi/presentation/kpi.controller.ts`

### API And End-To-End

- Modify: `test/kpi-budgets.e2e-spec.ts`
- Modify: `docs/api/rest-api.md`

## Scope And Slice Boundary

This plan covers only the budget follow-up expansion approved in:

- `docs/superpowers/specs/2026-03-29-budget-follow-up-daily-drilldown-design.md`

In scope:

- canonical follow-up classification extraction
- end-of-day fallback for `closingDate` when `closing_time` is absent or malformed
- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`
- drilldown filtering by `date`, `followUpWindow`, `followUpStatus`, `sellerId`, and `orderType`
- parser coverage, service coverage, controller/e2e coverage, and REST docs

Out of scope:

- frontend chart or modal work
- schema changes or new database tables
- snapshot materialization for follow-up daily
- pagination for the future follow-up listing screen
- changes to non-budget KPI families

## Implementation Decisions Locked In

### Shared follow-up classifier

Create one helper that accepts the minimum follow-up shape:

- `budgetDate`
- `budgetDatetime`
- `closingDate`
- `statusNormalized`
- `payloadJson`

The helper should return either:

- `null` when the row is not eligible for follow-up evaluation

or:

- `followUpWindow`
- `followUpStatus`
- `budgetDate`
- `resolvedOpeningAt`
- `resolvedClosingAt` nullable

This helper must be the single source of truth for:

- follow-up summary
- follow-up daily
- follow-up drilldown

### Drilldown data source

Use the existing repository method:

- `repository.getDrilldownRows(...)`

Reason:

- it already returns the detailed budget fields needed for the list response
- it already contains the fields required to classify follow-up state
- no repository SQL change is needed for this slice

### Ordering rules

Daily rows must be ordered by:

- `date` ascending
- `window` in the fixed order `within24h`, `after24h`
- `status` in the fixed order `converted`, `lost`, `open`

Drilldown rows must be ordered by:

- `budgetDatetime` descending
- `budgetDate` descending when needed
- `id` descending as the deterministic tie-breaker

## Task 1: Extract The Canonical Follow-Up Classifier

**Files:**
- Create: `src/modules/kpi/application/budget-follow-up-classifier.ts`
- Create: `src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

- [ ] **Step 1: Write the failing classifier tests**

Cover the core rules that the current inline implementation does not protect clearly enough:

```ts
import { classifyBudgetFollowUp } from './budget-follow-up-classifier'

describe('classifyBudgetFollowUp', () => {
  it('falls back to end of Sao Paulo closing day when closing_time is missing', () => {
    const result = classifyBudgetFollowUp(
      {
        budgetDate: new Date('2026-01-05T00:00:00-03:00'),
        budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
        closingDate: new Date('2026-01-05T00:00:00-03:00'),
        statusNormalized: 'WON',
        payloadJson: {},
      },
      new Date('2026-01-06T09:00:00-03:00'),
    )

    expect(result).toMatchObject({
      followUpWindow: 'within24h',
      followUpStatus: 'converted',
    })
  })

  it('falls back to end of Sao Paulo closing day when closing_time is malformed', () => {
    const result = classifyBudgetFollowUp(
      {
        budgetDate: new Date('2026-01-05T00:00:00-03:00'),
        budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
        closingDate: new Date('2026-01-05T00:00:00-03:00'),
        statusNormalized: 'LOST',
        payloadJson: { closing_time: 'bad-value' },
      },
      new Date('2026-01-06T09:00:00-03:00'),
    )

    expect(result).toMatchObject({
      followUpWindow: 'within24h',
      followUpStatus: 'lost',
    })
  })

  it('returns null when the budget opens after referenceAt', () => {
    const result = classifyBudgetFollowUp(
      {
        budgetDate: new Date('2026-01-07T00:00:00-03:00'),
        budgetDatetime: new Date('2026-01-07T10:00:00-03:00'),
        statusNormalized: 'OPEN',
        payloadJson: {},
      },
      new Date('2026-01-06T09:00:00-03:00'),
    )

    expect(result).toBeNull()
  })

  it('keeps won or lost rows open when closingDate is absent', () => {
    const result = classifyBudgetFollowUp(
      {
        budgetDate: new Date('2026-01-05T00:00:00-03:00'),
        budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
        statusNormalized: 'WON',
        payloadJson: {},
      },
      new Date('2026-01-06T09:00:00-03:00'),
    )

    expect(result).toMatchObject({
      followUpStatus: 'open',
    })
  })

  it('returns null for unknown status or invalid opening timestamp', () => {
    expect(
      classifyBudgetFollowUp(
        {
          budgetDate: new Date('2026-01-05T00:00:00-03:00'),
          budgetDatetime: 'not-a-date',
          statusNormalized: 'UNKNOWN',
          payloadJson: {},
        },
        new Date('2026-01-06T09:00:00-03:00'),
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the classifier test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Write the minimal classifier implementation**

Implement a small helper module with:

- exported enums/types for `followUpWindow` and `followUpStatus`
- a shared classifier function
- a private `closingAt` resolver that follows the approved chain:
  - explicit `closing_time` when valid
  - end of Sao Paulo day when `closing_time` is missing
  - end of Sao Paulo day when `closing_time` is malformed
  - return `null` only when `closingDate` itself is absent so the classifier can keep the row in `open`

Recommended shape:

```ts
export function classifyBudgetFollowUp(
  row: BudgetFollowUpSource,
  referenceAt: Date,
): BudgetFollowUpClassification | null {
  const status = normalizeBudgetFollowUpStatus(row.statusNormalized)
  const openedAt = toTimestamp(row.budgetDatetime)

  if (status === 'UNKNOWN' || openedAt === null || openedAt.getTime() > referenceAt.getTime()) {
    return null
  }

  const closingAt = resolveClosingAt(row)
  // choose converted/lost only when closingAt exists and is <= referenceAt
}
```

- [ ] **Step 4: Run the classifier test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-follow-up-classifier.ts src/modules/kpi/application/budget-follow-up-classifier.spec.ts
git commit -m "feat: add shared budget follow-up classifier"
```

## Task 2: Refactor Follow-Up Summary To Use The Shared Classifier

**Files:**
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing summary regression test**

Add a focused service test that proves summary now honors the end-of-day fallback rule:

```ts
it('treats won budgets without closing_time as converted by end of closing day in follow-up summary', async () => {
  repository.getBudgetFactRows.mockResolvedValue([
    {
      id: 1n,
      budgetDate: new Date('2026-01-05T00:00:00-03:00'),
      budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
      closingDate: new Date('2026-01-05T00:00:00-03:00'),
      sellerId: 7,
      sellerName: 'Maria',
      statusNormalized: 'WON',
      valueAmount: '100.00',
      payloadJson: {},
    },
  ])

  const result = await service.getFollowUpSummary({
    clientId: 'c1',
    from: '2026-01-01',
    to: '2026-01-31',
    referenceAt: '2026-01-06T09:00:00-03:00',
  })

  expect(result.within24h.converted.count).toBe(1)
  expect(result.within24h.open.count).toBe(0)
})
```

- [ ] **Step 2: Run the summary regression test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "treats won budgets without closing_time as converted by end of closing day in follow-up summary"`

Expected: FAIL because the current summary logic still treats that row as `open`.

- [ ] **Step 3: Replace the inline follow-up classification in the query service**

Refactor `BudgetKpiQueryService` so:

- `getFollowUpSummary(...)` keeps its public contract
- `buildFollowUpSummaryFromFacts(...)` consumes the shared classifier output
- the old inline closing-time and bucket logic is removed from the service where it becomes duplicate

Implementation direction:

```ts
const classification = classifyBudgetFollowUp(fact, referenceAt)

if (classification === null) {
  continue
}

grouped[classification.followUpWindow][classification.followUpStatus].push(fact)
```

- [ ] **Step 4: Run the summary regression test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "treats won budgets without closing_time as converted by end of closing day in follow-up summary"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts
git commit -m "refactor: reuse follow-up classifier in summary"
```

## Task 3: Add The Follow-Up Daily Service Contract

**Files:**
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing daily service test**

Add tests that prove the service:

- returns six rows per day with zero-filled gaps and fixed ordering
- excludes budgets opened after `referenceAt`

```ts
it('returns zero-filled follow-up daily rows for all six groups', async () => {
  repository.getBudgetFactRows.mockResolvedValue([
    {
      id: 1n,
      budgetDate: new Date('2026-01-05T00:00:00-03:00'),
      budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
      closingDate: new Date('2026-01-05T00:00:00-03:00'),
      sellerId: 7,
      sellerName: 'Maria',
      statusNormalized: 'WON',
      channel: 'Balcao',
      valueAmount: '100.00',
      payloadJson: {},
    },
  ])

  const result = await service.getFollowUpDaily({
    clientId: 'c1',
    from: '2026-01-05',
    to: '2026-01-06',
    referenceAt: '2026-01-06T09:00:00-03:00',
    sellerId: '7',
    orderType: 'Balcao',
  })

  expect(result.rows).toHaveLength(12)
  expect(result.rows[0]).toEqual({
    date: '2026-01-05',
    window: 'within24h',
    status: 'converted',
    count: 1,
    value: '100.0000',
  })
})

it('excludes budgets opened after referenceAt from follow-up daily rows', async () => {
  repository.getBudgetFactRows.mockResolvedValue([
    {
      id: 2n,
      budgetDate: new Date('2026-01-06T00:00:00-03:00'),
      budgetDatetime: new Date('2026-01-06T12:00:00-03:00'),
      sellerId: 7,
      sellerName: 'Maria',
      statusNormalized: 'OPEN',
      channel: 'Balcao',
      valueAmount: '55.00',
      payloadJson: {},
    },
  ])

  const result = await service.getFollowUpDaily({
    clientId: 'c1',
    from: '2026-01-05',
    to: '2026-01-06',
    referenceAt: '2026-01-06T09:00:00-03:00',
  })

  expect(result.rows.every((row) => row.count === 0 && row.value === '0.0000')).toBe(true)
})
```

- [ ] **Step 2: Run the daily service test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "returns zero-filled follow-up daily rows for all six groups"`

Expected: FAIL because `getFollowUpDaily` does not exist yet.

- [ ] **Step 3: Add the daily follow-up types and implementation**

In `budget-kpi-query.service.ts` add:

- `BudgetKpiFollowUpDailyInput`
- `BudgetKpiFollowUpDailyRow`
- `BudgetKpiFollowUpDailyResponse`
- `getFollowUpDaily(...)`

Implementation rules:

- reuse the same filtered fact source as follow-up summary
- carry the approved optional filters `sellerId` and `orderType`
- classify each fact through the shared helper
- aggregate by `date + followUpWindow + followUpStatus`
- zero-fill six rows for every day in the period
- keep the exact ordering approved in the spec

Recommended aggregation key:

```ts
const key = `${date}|${window}|${status}`
```

- [ ] **Step 4: Run the daily service test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "returns zero-filled follow-up daily rows for all six groups"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts
git commit -m "feat: add budget follow-up daily query service"
```

## Task 4: Add The Follow-Up Drilldown Service Contract

**Files:**
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing drilldown service test**

Add a service test that proves:

- `date` filters by opening day
- `followUpWindow` and `followUpStatus` filter by classified values
- returned rows are enriched with `followUpWindow` and `followUpStatus`
- rows are ordered descending by datetime
- rows without resolvable closure remain `open`

```ts
it('filters and orders follow-up drilldown rows by date window and status', async () => {
  repository.getDrilldownRows.mockResolvedValue([
    // include two rows on the same day with different follow-up classifications
  ])

  const result = await service.getFollowUpDrilldown({
    clientId: 'c1',
    from: '2026-01-01',
    to: '2026-01-31',
    referenceAt: '2026-01-31T18:30:00-03:00',
    date: '2026-01-05',
    followUpWindow: 'within24h',
    followUpStatus: 'open',
  })

  expect(result.filters).toEqual({
    referenceAt: '2026-01-31T18:30:00-03:00',
    date: '2026-01-05',
    followUpWindow: 'within24h',
    followUpStatus: 'open',
  })
  expect(result.rows[0]).toMatchObject({
    followUpWindow: 'within24h',
    followUpStatus: 'open',
  })
})

it('keeps rows without resolvable closure as open in follow-up drilldown', async () => {
  repository.getDrilldownRows.mockResolvedValue([
    {
      id: 101n,
      clientId: 'c1',
      sourceTable: 'raw.ferraco_budgets',
      sourceRecordId: 123,
      branchName: 'Matriz',
      branchId: 5,
      sellerId: 7,
      sellerName: 'Maria',
      budgetDate: new Date('2026-01-05T00:00:00-03:00'),
      budgetDatetime: new Date('2026-01-05T08:00:00-03:00'),
      closingDate: null,
      statusNormalized: 'WON',
      channel: 'Balcao',
      customerName: 'ACME LTDA',
      cpfCnpj: null,
      valueAmount: '200.0000',
      sequential: null,
      davId: 777n,
      sequentialLinkedSale: null,
      payloadJson: {},
    },
  ])

  const result = await service.getFollowUpDrilldown({
    clientId: 'c1',
    from: '2026-01-01',
    to: '2026-01-31',
    referenceAt: '2026-01-31T18:30:00-03:00',
    followUpStatus: 'open',
  })

  expect(result.rows[0]).toMatchObject({
    followUpStatus: 'open',
  })
})
```

- [ ] **Step 2: Run the drilldown service test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "filters and orders follow-up drilldown rows by date window and status"`

Expected: FAIL because `getFollowUpDrilldown` does not exist yet.

- [ ] **Step 3: Implement the follow-up drilldown method**

Add to `budget-kpi-query.service.ts`:

- `BudgetKpiFollowUpDrilldownInput`
- `BudgetKpiFollowUpDrilldownFilters`
- `BudgetKpiFollowUpDrilldownRow`
- `BudgetKpiFollowUpDrilldownResponse`
- `getFollowUpDrilldown(...)`

Implementation rules:

- fetch rows through `repository.getDrilldownRows(...)`
- apply optional `sellerId` and `orderType` at the existing query/filtering layer
- classify each row with the shared classifier
- filter optionally by `date`, `followUpWindow`, and `followUpStatus`
- serialize the base drilldown row plus the new follow-up fields
- order descending by `budgetDatetime`, then `budgetDate`, then `id`

Recommended row enrichment:

```ts
return {
  ...this.toDrilldownRow(row),
  followUpWindow: classification.followUpWindow,
  followUpStatus: classification.followUpStatus,
}
```

- [ ] **Step 4: Run the drilldown service test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-query.service.spec.ts -t "filters and orders follow-up drilldown rows by date window and status"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts
git commit -m "feat: add budget follow-up drilldown query service"
```

## Task 5: Add Shared Follow-Up Query Parsers

**Files:**
- Create: `src/modules/kpi/presentation/query/budget-follow-up-common.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-daily.query.ts`
- Create: `src/modules/kpi/presentation/query/budget-follow-up-drilldown.query.ts`
- Modify: `src/modules/kpi/presentation/query/budget-follow-up-summary.query.ts`

- [ ] **Step 1: Write the failing parser tests**

Use one parser spec file to cover the shared behavior:

```ts
import { BadRequestException } from '@nestjs/common'
import { parseBudgetFollowUpDailyQuery } from './budget-follow-up-daily.query'
import { parseBudgetFollowUpDrilldownQuery } from './budget-follow-up-drilldown.query'

describe('budget follow-up query parsers', () => {
  it('normalizes referenceAt without timezone as Sao Paulo time', () => {
    expect(
      parseBudgetFollowUpDailyQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: '2026-01-31T18:30',
      }),
    ).toMatchObject({
      referenceAt: '2026-01-31T18:30',
    })
  })

  it('rejects invalid referenceAt', () => {
    expect(() =>
      parseBudgetFollowUpDailyQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: 'not-a-date',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid date on drilldown', () => {
    expect(() =>
      parseBudgetFollowUpDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: '2026-01-31T18:30:00-03:00',
        date: '31-01-2026',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid followUpStatus', () => {
    expect(() =>
      parseBudgetFollowUpDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: '2026-01-31T18:30:00-03:00',
        followUpStatus: 'closed',
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects invalid followUpWindow', () => {
    expect(() =>
      parseBudgetFollowUpDrilldownQuery({
        from: '2026-01-01',
        to: '2026-01-31',
        referenceAt: '2026-01-31T18:30:00-03:00',
        followUpWindow: 'same-day',
      }),
    ).toThrow(BadRequestException)
  })
})
```

- [ ] **Step 2: Run the parser test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`

Expected: FAIL because the new parser modules do not exist yet.

- [ ] **Step 3: Implement the shared parser helpers and route parsers**

Create a shared query helper module for:

- `referenceAt` validation using Sao Paulo fallback semantics
- shared `sellerId` and `orderType` parsing
- `followUpWindow` and `followUpStatus` enums
- optional `date` validation

Then:

- update `budget-follow-up-summary.query.ts` to consume the shared `referenceAt` logic
- add `budget-follow-up-daily.query.ts`
- add `budget-follow-up-drilldown.query.ts`

Reference-at contract to preserve:

- the parser may normalize `referenceAt` internally for validation
- the parser should return the trimmed original `referenceAt` text to keep the controller and e2e contract aligned with the current follow-up summary behavior
- the service remains responsible for turning that text into a `Date`
- the drilldown `filters.referenceAt` echo should use that trimmed original text

Recommended shared exports:

```ts
export const followUpWindowSchema = z.enum(['within24h', 'after24h'])
export const followUpStatusSchema = z.enum(['converted', 'lost', 'open'])
export function normalizeReferenceAtText(value: string): string { ... }
```

- [ ] **Step 4: Run the parser test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/presentation/query/budget-follow-up-common.query.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts src/modules/kpi/presentation/query/budget-follow-up-daily.query.ts src/modules/kpi/presentation/query/budget-follow-up-drilldown.query.ts src/modules/kpi/presentation/query/budget-follow-up-summary.query.ts
git commit -m "feat: add budget follow-up query parsers"
```

## Task 6: Wire Controller Routes And E2E Coverage

**Files:**
- Modify: `src/modules/kpi/presentation/kpi.controller.ts`
- Modify: `test/kpi-budgets.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e tests**

Extend `test/kpi-budgets.e2e-spec.ts` with:

- a success case for `GET /kpis/budgets/follow-up/daily`
- a success case for `GET /kpis/budgets/follow-up/drilldown`
- a `400` case when `referenceAt` is missing on both new routes

Representative test:

```ts
it('returns the budget follow-up daily rows for the active tenant client', async () => {
  await request(app.getHttpServer())
    .get('/kpis/budgets/follow-up/daily')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', 'tenant-1')
    .query({
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30:00-03:00',
      sellerId: '7',
      orderType: 'Balcao',
    })
    .expect(200)

  expect(queryService.getFollowUpDaily).toHaveBeenCalledWith({
    clientId: 'client-1',
    from: '2026-01-01',
    to: '2026-01-31',
    referenceAt: '2026-01-31T18:30:00-03:00',
    sellerId: 7,
    orderType: 'Balcao',
  })
})

it('echoes follow-up drilldown filters when they are supplied', async () => {
  await request(app.getHttpServer())
    .get('/kpis/budgets/follow-up/drilldown')
    .set('Authorization', `Bearer ${token}`)
    .set('X-Tenant-Id', 'tenant-1')
    .query({
      from: '2026-01-01',
      to: '2026-01-31',
      referenceAt: '2026-01-31T18:30:00-03:00',
      date: '2026-01-05',
      sellerId: '7',
      orderType: 'Balcao',
      followUpWindow: 'within24h',
      followUpStatus: 'open',
    })
    .expect(200)
    .expect((response) => {
      expect(response.body.filters).toMatchObject({
        referenceAt: '2026-01-31T18:30:00-03:00',
        date: '2026-01-05',
        sellerId: 7,
        orderType: 'Balcao',
        followUpWindow: 'within24h',
        followUpStatus: 'open',
      })
    })
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "budget follow-up"`

Expected: FAIL because the controller routes and mocked service methods are not wired yet.

- [ ] **Step 3: Implement the controller wiring**

Update `kpi.controller.ts` to add:

- `@Get('follow-up/daily')`
- `@Get('follow-up/drilldown')`

Also update the e2e spy setup so `BudgetKpiQueryService` mocks:

- `getFollowUpDaily`
- `getFollowUpDrilldown`

Make the mocked `getFollowUpDrilldown` response explicitly include the echoed `filters` object used by the new assertion so the test proves controller wiring instead of passing on a generic default shape.

Controller methods should only:

- parse the query
- inject `clientId`
- forward the request to the service

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "budget follow-up"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/presentation/kpi.controller.ts test/kpi-budgets.e2e-spec.ts
git commit -m "feat: add budget follow-up routes"
```

## Task 7: Update REST Docs And Run Focused Verification

**Files:**
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Verify the new REST sections are absent before editing**

Run: `Select-String -Path 'docs\\api\\rest-api.md' -Pattern 'GET /kpis/budgets/follow-up/daily|GET /kpis/budgets/follow-up/drilldown'`

Expected: no matching output before the doc update.

- [ ] **Step 2: Update the REST API docs**

Document:

- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`

Be explicit about:

- `date` meaning the budget opening date bucket
- `referenceAt` timezone fallback
- `followUpWindow` and `followUpStatus` being classification filters, not raw budget status filters
- the drilldown `filters` object echoing `referenceAt`, `date`, `followUpWindow`, `followUpStatus`, `sellerId`, and `orderType` when provided

- [ ] **Step 3: Run focused verification for the whole slice**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts test/kpi-budgets.e2e-spec.ts`

Expected: PASS

Run: `Select-String -Path 'docs\\api\\rest-api.md' -Pattern 'GET /kpis/budgets/follow-up/daily|GET /kpis/budgets/follow-up/drilldown'`

Expected: both new headings are found.

- [ ] **Step 4: Commit**

```bash
git add docs/api/rest-api.md
git commit -m "docs: add budget follow-up daily and drilldown api docs"
```
