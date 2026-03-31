# Budget Cancellation Follow-Up Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cancellation date/time support to budget facts and use it to classify canceled budgets correctly across budget follow-up summary, daily, and drilldown endpoints.

**Architecture:** Extend the existing budget fact ingestion chain so `core.budget_facts` persists `cancellationDate` and `cancelationTime`, then thread those fields through the shared follow-up classifier and budget drilldown serializers. Keep the current NestJS KPI module structure, reuse the existing classifier-centric follow-up design, and protect the change with normalization, classifier, service, and e2e regression tests.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, Jest, Supertest

---

## Planned File Structure

### Schema And Normalization

- Create: `prisma/migrations/20260331_add_budget_cancellation_fields.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/normalization/application/budget-normalization.service.ts`
- Modify: `src/modules/normalization/application/budget-normalization.service.spec.ts`

### KPI Application

- Modify: `src/modules/kpi/application/budget-follow-up-classifier.ts`
- Modify: `src/modules/kpi/application/budget-follow-up-classifier.spec.ts`
- Modify: `src/modules/kpi/application/budget-kpi-refresh.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`

### Repository And Transport

- Modify: `src/modules/kpi/kpi.module.ts`
- Create: `src/modules/kpi/kpi.module.spec.ts`
- Modify: `test/kpi-budgets.e2e-spec.ts`
- Modify: `docs/api/rest-api.md`

## Scope And Slice Boundary

This plan implements the approved spec in:

- `docs/superpowers/specs/2026-03-31-budget-cancellation-follow-up-adjustment-design.md`

In scope:

- `BudgetFact` schema additions for cancellation data
- raw budget normalization and bulk upsert support for cancellation data
- follow-up classifier support for `LOST` budgets based on cancellation timestamp
- query-service propagation of the new fields through summary, daily, drilldown, and follow-up drilldown
- drilldown response exposure of `cancellationDate` and `cancelationTime`
- focused docs and e2e updates for the changed drilldown payloads

Out of scope:

- frontend changes
- pagination or new list endpoints
- changes to non-budget KPI families
- replacing the existing `WON` closing logic

## Implementation Decisions Locked In

### Canonical cancellation fields

Use these as the structured application fields everywhere after normalization:

- `cancellationDate`
- `cancelationTime`

Database mapping:

- `cancellationDate` -> `cancellation_date`
- `cancelationTime` -> `cancelation_time`

### Follow-up terminal timestamp precedence

For `LOST` rows:

- prefer structured `cancellationDate` + structured `cancelationTime`
- if structured date exists and structured time is absent or invalid, use end of Sao Paulo day
- if structured fields are absent, fall back to legacy payload keys `cancellation_date` or `cancellationDate` for date and `cancelation_time` or `cancelationTime` for time
- if only legacy date exists, combine it with legacy time when valid, otherwise use end of Sao Paulo day
- never merge date from one source with time from the other source
- if no valid terminal date is available, keep the row classified as `open` at `referenceAt`

### Drilldown contract

Both drilldowns must expose:

- `cancellationDate`
- `cancelationTime`

The follow-up drilldown must continue exposing:

- `followUpWindow`
- `followUpStatus`

## Task 1: Persist Cancellation Data In Budget Facts

**Files:**
- Create: `prisma/migrations/20260331_add_budget_cancellation_fields.sql`
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/normalization/application/budget-normalization.service.ts`
- Modify: `src/modules/normalization/application/budget-normalization.service.spec.ts`

- [ ] **Step 1: Write the failing normalization tests**

Add coverage proving that normalization persists structured cancellation data in both the manual upsert payload and the bulk upsert SQL path.

Representative assertions:

```ts
expect(upsertArgs.create).toMatchObject({
  cancellationDate: new Date(2026, 0, 16),
  cancelationTime: '14:30:00',
  payloadJson: {
    source: 'fixture',
    closing_time: '16:45:00',
    cancelation_time: '14:30:00',
  },
})

expect(sql).toContain('budget.cancellation_date')
expect(sql).toContain('budget.cancelation_time::text')
expect(sql).toContain('cancellation_date')
expect(sql).toContain('cancelation_time')
```

- [ ] **Step 2: Run the normalization test to verify it fails**

Run: `npm test -- --runInBand src/modules/normalization/application/budget-normalization.service.spec.ts`

Expected: FAIL because the schema, raw reader, and normalization payloads do not include the cancellation fields yet.

- [ ] **Step 3: Implement the schema and normalization changes**

Update the Prisma model and the normalization flow so that:

- a new SQL migration adds `cancellation_date date null` and `cancelation_time text null` to `core.budget_facts`
- `BudgetFact` includes `cancellationDate` and `cancelationTime`
- `RawFerracoBudgetRecord` reads:

```ts
cancellationDate: string | Date | null
cancelationTime: string | Date | null
```

- the raw query selects:

```sql
budget.cancellation_date AS "cancellationDate",
budget.cancelation_time::text AS "cancelationTime"
```

- manual normalization includes the structured fields on `BudgetFactWritePayload`
- bulk upsert inserts and updates the new columns in `core.budget_facts`
- normalized `payloadJson` stores `cancelation_time` when a non-empty raw value is present

Migration shape:

```sql
ALTER TABLE core.budget_facts
  ADD COLUMN cancellation_date date NULL,
  ADD COLUMN cancelation_time text NULL;
```

- [ ] **Step 4: Run the normalization test to verify it passes**

- [ ] **Step 4: Regenerate the Prisma client before the next task**

Run: `npm run prisma:generate`

Expected: PASS so the generated client already reflects the new `BudgetFact` fields for the classifier and repository tasks that follow.

- [ ] **Step 5: Run the normalization test to verify it passes**

Run: `npm test -- --runInBand src/modules/normalization/application/budget-normalization.service.spec.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/20260331_add_budget_cancellation_fields.sql prisma/schema.prisma src/modules/normalization/application/budget-normalization.service.ts src/modules/normalization/application/budget-normalization.service.spec.ts
git commit -m "feat: persist budget cancellation fields"
```

## Task 2: Teach The Follow-Up Classifier About Cancellation

**Files:**
- Modify: `src/modules/kpi/application/budget-follow-up-classifier.ts`
- Modify: `src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

- [ ] **Step 1: Write the first failing classifier test for structured cancellation**

Start with the smallest red step:

```ts
it('classifies LOST rows from structured cancellation date and time', () => {
  const fact = makeFact({
    statusNormalized: 'LOST',
    closingDate: null,
    cancellationDate: '2026-01-10',
    cancelationTime: '12:00:00',
    payloadJson: null,
  })

  expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 14, 59, 59, 999))).toEqual({
    window: followUpWindow.within24h,
    status: followUpStatus.open,
  })
  expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 15, 0, 0, 1))).toEqual({
    window: followUpWindow.within24h,
    status: followUpStatus.lost,
  })
})
```

- [ ] **Step 2: Run the structured-cancellation classifier test to verify it fails**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts -t "classifies LOST rows from structured cancellation date and time"`

Expected: FAIL because the classifier does not accept cancellation fields yet.

- [ ] **Step 3: Implement the minimal structured cancellation path**

Extend `BudgetFollowUpSourceRecord` and the classifier just enough to support:

- `cancellationDate`
- `cancelationTime`
- `LOST` rows resolved from the structured cancellation pair

- [ ] **Step 4: Run the structured-cancellation classifier test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts -t "classifies LOST rows from structured cancellation date and time"`

Expected: PASS

- [ ] **Step 5: Write the second batch of failing classifier tests**

Add the remaining precedence and regression tests:

```ts
it('falls back to end of Sao Paulo cancellation day when cancelationTime is missing', () => {
  // expect LOST only after end-of-day cutoff
})

it('falls back to legacy payload cancellation keys when structured fields are absent', () => {
  // expect LOST based on payload cancellation date/time
})

it('does not merge structured date with legacy time', () => {
  // expect end-of-day based on structured date
})

it('keeps WON rows resolved from closingDate plus closingTime', () => {
  const fact = makeFact({
    statusNormalized: 'WON',
    closingDate: '2026-01-10',
    payloadJson: { closingTime: '12:00:00' },
  })

  expect(classifyBudgetFollowUpRecord(fact, utcDate(2026, 0, 10, 15, 0, 0, 1))).toEqual({
    window: followUpWindow.within24h,
    status: followUpStatus.converted,
  })
})

it('prefers structured cancellation fields over legacy payload values when both exist', () => {
  // expect the structured timestamp to decide the LOST cutoff
})

it('supports legacy cancellation date plus legacy cancellation time when structured fields are absent', () => {
  // expect LOST based on payload cancellation_date + cancelation_time
})
```

- [ ] **Step 6: Run the full classifier test file to verify the new cases fail**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

Expected: FAIL on one or more of the new precedence/regression cases.

- [ ] **Step 7: Implement the remaining precedence and regression logic**

Extend `BudgetFollowUpSourceRecord` and terminal resolution so that:

- the input accepts `cancellationDate` and `cancelationTime`
- `WON` keeps the current `closingDate` logic
- `LOST` resolves terminal timestamp using the locked precedence rules from this plan
- `resolveClosingAt` is replaced or split into a status-aware terminal resolver
- `BudgetFollowUpSourceRecord` remains the single input shape for summary, daily, and drilldown follow-up classification

Suggested direction:

```ts
function resolveTerminalAt(fact: BudgetFollowUpSourceRecord, status: FollowUpStatus): Date | null {
  if (status === followUpStatus.converted) {
    return resolveWonClosingAt(fact)
  }

  if (status === followUpStatus.lost) {
    return resolveLostCancellationAt(fact)
  }

  return null
}
```

- [ ] **Step 8: Run the classifier test to verify it passes**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-follow-up-classifier.spec.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/kpi/application/budget-follow-up-classifier.ts src/modules/kpi/application/budget-follow-up-classifier.spec.ts
git commit -m "feat: classify cancelled budget follow-ups"
```

## Task 3: Thread Cancellation Data Through Budget Query And Drilldown Shapes

**Files:**
- Modify: `src/modules/kpi/application/budget-kpi-refresh.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-refresh.service.spec.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/budget-kpi-query.service.spec.ts`
- Modify: `src/modules/kpi/kpi.module.ts`
- Create: `src/modules/kpi/kpi.module.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Add query-service coverage proving that:

- follow-up summary/daily/drilldown classify canceled budgets as `lost` once cancellation time passes
- generic drilldown serializes `cancellationDate` and `cancelationTime`
- follow-up drilldown serializes `cancellationDate`, `cancelationTime`, `followUpWindow`, and `followUpStatus`
- refresh service specs still accept the expanded budget fact shape without changing summary/daily/drilldown materialization behavior
- a `WON` regression continues to classify from `closingDate + closingTime`
- a repository-integration test exercises the real `PrismaBudgetKpiRepository` select shape in `kpi.module.ts` so missing `select` fields are caught without mocking the repository away

Representative expectations:

```ts
expect(result.within24h.lost.count).toBe(1)
expect(result.rows[0]).toMatchObject({
  cancellationDate: '2026-01-10',
  cancelationTime: '12:00:00',
})
expect(followUpDrilldown.rows[0]).toMatchObject({
  cancellationDate: '2026-01-10',
  cancelationTime: '12:00:00',
  followUpStatus: 'lost',
})
```

- [ ] **Step 2: Run the query-service tests to verify they fail**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-refresh.service.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/kpi.module.spec.ts`

Expected: FAIL because the fact/query shapes and serializers do not include the new fields yet, and `LOST` follow-up still does not use cancellation timestamps.

- [ ] **Step 3: Implement the query-shape and serializer updates**

Update the KPI application and repository layer so that:

- `BudgetFactRecord` includes `cancellationDate` and `cancelationTime`
- `BudgetKpiDrilldownFactRow` includes `cancellationDate` and `cancelationTime`
- the Prisma repository selects in `kpi.module.ts` fetch the new fields from `budgetFact`
- `src/modules/kpi/kpi.module.spec.ts` proves `BudgetKpiQueryService` running against the real repository layer receives `cancellationDate` and `cancelationTime` from Prisma-backed rows
- `BudgetFollowUpSourceRecord` calls in summary/daily/drilldown pass the new structured fields into the classifier
- `toDrilldownRow(...)` serializes:

```ts
cancellationDate: row.cancellationDate ? this.toDateKey(row.cancellationDate) : null,
cancelationTime: row.cancelationTime ?? null,
```

- generic drilldown and follow-up drilldown both preserve their existing fields while adding the cancellation fields
- any refresh-layer types shared by the query service stay aligned with the new budget fact shape

- [ ] **Step 4: Run the query-service tests to verify they pass**

Run: `npm test -- --runInBand src/modules/kpi/application/budget-kpi-refresh.service.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/kpi.module.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/application/budget-kpi-refresh.service.ts src/modules/kpi/application/budget-kpi-refresh.service.spec.ts src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/kpi.module.ts src/modules/kpi/kpi.module.spec.ts
git commit -m "feat: expose budget cancellation fields in kpis"
```

## Task 4: Update Endpoint Contracts And API Documentation

**Files:**
- Modify: `test/kpi-budgets.e2e-spec.ts`
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Write the failing e2e assertions**

Extend the existing drilldown endpoint tests to assert the new response fields:

```ts
expect(response.body.rows[0]).toMatchObject({
  cancellationDate: '2026-01-10',
  cancelationTime: '12:00:00',
})
```

Do this for:

- `GET /kpis/budgets/drilldown`
- `GET /kpis/budgets/follow-up/drilldown`

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "drilldown"`

Expected: FAIL because the mocked responses and assertions do not yet reflect the new contract.

- [ ] **Step 3: Update mocked endpoint contracts and REST docs**

Adjust the e2e mocks and docs so that:

- both drilldowns show `cancellationDate` and `cancelationTime`
- follow-up drilldown still documents `followUpWindow` and `followUpStatus`
- docs explain that canceled follow-up classification now uses cancellation timestamp rather than generic closing logic

Add/update examples in `docs/api/rest-api.md` for:

- `GET /kpis/budgets/drilldown`
- `GET /kpis/budgets/follow-up/drilldown`

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `npm test -- --runInBand test/kpi-budgets.e2e-spec.ts -t "drilldown"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/kpi-budgets.e2e-spec.ts docs/api/rest-api.md
git commit -m "docs: expose budget cancellation drilldown fields"
```

## Task 5: Run Focused Final Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run the full focused verification suite**

Run:

```bash
npm test -- --runInBand src/modules/normalization/application/budget-normalization.service.spec.ts src/modules/kpi/application/budget-follow-up-classifier.spec.ts src/modules/kpi/application/budget-kpi-refresh.service.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts test/kpi-budgets.e2e-spec.ts
```

Expected: PASS

- [ ] **Step 2: Regenerate and validate Prisma client artifacts**

Run:

```bash
npm run prisma:generate
```

Expected: PASS

Run:

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Re-run the repository-sensitive focused suite after the generated client refresh**

Run:

```bash
npm test -- --runInBand src/modules/kpi/kpi.module.spec.ts test/kpi-budgets.e2e-spec.ts
```

Expected: PASS

- [ ] **Step 4: Run the TypeScript build verification**

Run:

```bash
npx tsc -p tsconfig.build.json --pretty false
```

Expected: PASS

- [ ] **Step 5: Verify the docs mention the updated drilldown fields**

Run:

```bash
Select-String -Path 'docs\api\rest-api.md' -Pattern 'cancellationDate|cancelationTime|follow-up/drilldown|/kpis/budgets/drilldown'
```

Expected: matches for both cancellation fields and both drilldown sections.
