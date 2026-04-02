# KPI Branch Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional single-select `branchId` backend filter across budgets, sales, calls, and whatsapp KPI routes, preserving current behavior when the filter is absent.

**Architecture:** Budgets and sales will filter directly on `core.budget_facts.branch_id` and `core.sale_facts.branch_id`. Calls and whatsapp will resolve branch membership through `core.employees` and exclude unmatched or ambiguous records when `branchId` is active. Query parsers, services, repositories, e2e coverage, and REST docs will be updated together so the public contract stays consistent.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL SQL, Jest, Supertest, Markdown

---

### Task 1: Extend budgets and sales contracts with `branchId`

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-filters.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-filters.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-follow-up-common.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\sale-filters.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\sale-filters.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\sale-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\sale-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-budgets.e2e-spec.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-sales.e2e-spec.ts`

- [ ] **Step 1: Write the failing parser tests for budgets and sales**

```ts
expect(
  parseBudgetFactFiltersQuery(
    { from: "2026-03-01", to: "2026-03-31", branchId: "5" },
    "Invalid budget summary query params",
  ),
).toEqual({
  from: "2026-03-01",
  to: "2026-03-31",
  sellerId: undefined,
  status: undefined,
  orderType: undefined,
  branchId: 5,
})
```

- [ ] **Step 2: Write the failing service tests for direct branch filtering**

```ts
await service.getSummary({
  clientId: "client-1",
  from: "2026-03-01",
  to: "2026-03-31",
  branchId: 5,
})

expect(repository.getBudgetFactRows).toHaveBeenCalledWith({
  clientId: "client-1",
  period: expect.any(KpiPeriod),
  sellerId: undefined,
  branchId: 5,
})
```

- [ ] **Step 3: Write the failing e2e tests for `branchId` on budgets and sales**

```ts
await request(app.getHttpServer())
  .get("/kpis/budgets/summary?from=2026-03-01&to=2026-03-31&branchId=5")
  .set("Authorization", "Bearer valid-token")
  .set("X-Tenant-Id", tenantId)
  .expect(200)
```

- [ ] **Step 4: Run the targeted tests to verify they fail for missing `branchId` support**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/budget-filters.query.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts src/modules/kpi/presentation/query/sale-filters.query.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/application/sale-kpi-query.service.spec.ts test/kpi-budgets.e2e-spec.ts test/kpi-sales.e2e-spec.ts`
Expected: FAIL with parser or repository expectations that do not yet include `branchId`

- [ ] **Step 5: Implement parser support and direct fact filtering**

```ts
export type BudgetFactFiltersQuery = BudgetBasePeriodQuery & {
  sellerId?: number
  status?: BudgetStatusQuery
  orderType?: string
  branchId?: number
}
```

```ts
return prisma.budgetFact.findMany({
  where: {
    clientId: input.clientId,
    budgetDate: { gte: from, lte: to },
    ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
    ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
  },
})
```

- [ ] **Step 6: Re-run the targeted tests and confirm they pass**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/budget-filters.query.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.spec.ts src/modules/kpi/presentation/query/sale-filters.query.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/application/sale-kpi-query.service.spec.ts test/kpi-budgets.e2e-spec.ts test/kpi-sales.e2e-spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/kpi/presentation/query/budget-filters.query.ts src/modules/kpi/presentation/query/budget-filters.query.spec.ts src/modules/kpi/presentation/query/budget-follow-up-common.query.ts src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/presentation/query/sale-filters.query.ts src/modules/kpi/presentation/query/sale-filters.query.spec.ts src/modules/kpi/application/sale-kpi-query.service.ts src/modules/kpi/application/sale-kpi-query.service.spec.ts src/modules/kpi/kpi.module.ts test/kpi-budgets.e2e-spec.ts test/kpi-sales.e2e-spec.ts
git commit -m "feat: add branch filter to budget and sale kpis"
```

### Task 2: Add shared branch scope validation for KPI queries

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\companies\application\branch-scope.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\companies\companies.module.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\companies\application\employees.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\sale-kpi-query.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\companies\application\branch-scope.service.spec.ts`

- [ ] **Step 1: Write the failing branch scope service tests**

```ts
await expect(service.assertClientBranchScope("client-1", 99)).rejects.toThrow(
  "Branch is outside the active client scope",
)
```

- [ ] **Step 2: Run the new test and verify it fails because the service does not exist**

Run: `npm test -- --runInBand src/modules/companies/application/branch-scope.service.spec.ts`
Expected: FAIL with module or import resolution error

- [ ] **Step 3: Implement a shared branch scope service and wire it into modules**

```ts
@Injectable()
export class BranchScopeService {
  async assertClientBranchScope(clientId: string, branchId?: number): Promise<void> {
    if (branchId === undefined) return
    // fixtures/prisma lookup, then throw ForbiddenException when branch is outside scope
  }
}
```

- [ ] **Step 4: Replace duplicated branch scope logic in employees and inject the shared service into budget and sale KPI services**

```ts
await this.branchScopeService.assertClientBranchScope(input.clientId, branchId)
```

- [ ] **Step 5: Re-run the scope validation tests**

Run: `npm test -- --runInBand src/modules/companies/application/branch-scope.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/companies/application/branch-scope.service.ts src/modules/companies/application/branch-scope.service.spec.ts src/modules/companies/application/employees.service.ts src/modules/companies/companies.module.ts src/modules/kpi/kpi.module.ts src/modules/kpi/application/budget-kpi-query.service.ts src/modules/kpi/application/sale-kpi-query.service.ts
git commit -m "refactor: share branch scope validation"
```

### Task 3: Add `branchId` filtering to calls KPIs

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-filters.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-filters.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-call-kpi.repository.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-call-kpi.repository.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-calls.e2e-spec.ts`

- [ ] **Step 1: Write the failing parser and service tests for call `branchId`**

```ts
expect(
  parseCallFactFiltersQuery(
    { from: "2026-03-01", to: "2026-03-31", branchId: "5" },
    "Invalid call summary query params",
  ),
).toEqual({
  from: "2026-03-01",
  to: "2026-03-31",
  extensionUuid: undefined,
  extensionNumber: undefined,
  branchId: 5,
})
```

```ts
await service.getSummary({
  clientId: "client-1",
  from: "2026-03-01",
  to: "2026-03-31",
  branchId: 5,
})
expect(repository.getCallFactRows).toHaveBeenCalledWith({
  clientId: "client-1",
  period: expect.any(KpiPeriod),
  branchId: 5,
})
```

- [ ] **Step 2: Write the failing repository tests for employee-derived branch filtering**

```ts
expect(prisma.callFact.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({
      clientId: "client-1",
    }),
  }),
)
```

Adicione assertions para garantir que o caminho filtrado use `employees` da branch e exclua correspondencias ambiguas.

- [ ] **Step 3: Run the call-focused test set and confirm the failures**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/call-filters.query.spec.ts src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts test/kpi-calls.e2e-spec.ts`
Expected: FAIL because `branchId` is not yet parsed or propagated

- [ ] **Step 4: Implement `branchId` parsing and service propagation for calls**

```ts
export type CallFactFiltersQuery = CallBasePeriodQuery & {
  extensionUuid?: string
  extensionNumber?: string
  branchId?: number
}
```

```ts
await this.branchScopeService.assertClientBranchScope(input.clientId, branchId)
```

- [ ] **Step 5: Extend the repository contract to filter calls by employees in the selected branch**

```ts
getCallFactRows(input: { clientId: string; period: KpiPeriod; branchId?: number }): Promise<CallFactRecord[]>
```

```ts
where: {
  branch: { is: { clientId, id: branchId } },
  OR: [
    { extensionUuid: { in: extensionUuids } },
    { extensionNumber: { in: extensionNumbers } },
  ],
}
```

- [ ] **Step 6: Implement strict filtered-mode behavior**

```ts
if (branchId !== undefined) {
  // only facts matched to exactly one employee in the selected branch survive
}
```

- [ ] **Step 7: Cover `hourly/comparison` so the telemarketing budget side also honors `branchId`**

```ts
getTelemarketingBudgetRows(input: {
  clientId: string
  period: KpiPeriod
  branchId?: number
}): Promise<TelemarketingBudgetFactRecord[]>
```

- [ ] **Step 8: Re-run the call-focused tests**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/call-filters.query.spec.ts src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts test/kpi-calls.e2e-spec.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/kpi/presentation/query/call-filters.query.ts src/modules/kpi/presentation/query/call-filters.query.spec.ts src/modules/kpi/application/call-kpi-query.service.ts src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts test/kpi-calls.e2e-spec.ts
git commit -m "feat: add branch filter to call kpis"
```

### Task 4: Add `branchId` filtering to WhatsApp KPIs

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-whatsapp.e2e-spec.ts`

- [ ] **Step 1: Write the failing parser tests for WhatsApp `branchId`**

```ts
expect(
  parseWhatsAppSummaryQuery({
    from: "2026-03-01",
    to: "2026-03-31",
    branchId: "5",
  }),
).toEqual({
  from: "2026-03-01",
  to: "2026-03-31",
  chatId: undefined,
  branchId: 5,
})
```

- [ ] **Step 2: Write the failing service tests to pass `branchId` into repository calls**

```ts
await service.getSessionsDaily({
  clientId: "client-1",
  from: "2026-03-01",
  to: "2026-03-31",
  branchId: 5,
})
expect(repository.getSessionsDailyRows).toHaveBeenCalledWith({
  clientId: "client-1",
  period: expect.any(KpiPeriod),
  chatId: undefined,
  branchId: 5,
})
```

- [ ] **Step 3: Write the failing repository tests for branch-filtered SQL**

```ts
expect(queryText).toContain("lower(btrim(e.chat_id))")
expect(queryText).toContain("e.branch_id =")
```

- [ ] **Step 4: Run the WhatsApp-focused test set and verify it fails first**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/whatsapp-summary.query.spec.ts src/modules/kpi/presentation/query/whatsapp-tag-hourly-comparison.query.spec.ts src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts test/kpi-whatsapp.e2e-spec.ts`
Expected: FAIL because `branchId` is not yet supported

- [ ] **Step 5: Implement parser and service support for optional `branchId`**

```ts
export type WhatsAppSummaryQuery = {
  from: string
  to: string
  chatId?: string
  branchId?: number
}
```

```ts
await this.branchScopeService.assertClientBranchScope(input.clientId, branchId)
```

- [ ] **Step 6: Extend repository methods and SQL to constrain employees by branch**

```sql
join employee_lookup on ...
where employee_lookup.branch_id = $branchId
```

Use an employee lookup CTE or equivalent join keyed by `lower(btrim(e.chat_id))`, and exclude unmatched rows automatically when `branchId` is active.

- [ ] **Step 7: Preserve current no-filter behavior and `chatId` semantics**

```ts
${input.branchId === undefined ? Prisma.empty : Prisma.sql`and employee_lookup.branch_id = ${input.branchId}`}
```

- [ ] **Step 8: Re-run the WhatsApp-focused tests**

Run: `npm test -- --runInBand src/modules/kpi/presentation/query/whatsapp-summary.query.spec.ts src/modules/kpi/presentation/query/whatsapp-tag-hourly-comparison.query.spec.ts src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts test/kpi-whatsapp.e2e-spec.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/kpi/presentation/query/whatsapp-summary.query.ts src/modules/kpi/presentation/query/whatsapp-summary.query.spec.ts src/modules/kpi/presentation/query/whatsapp-tag-hourly.query.ts src/modules/kpi/presentation/query/whatsapp-tag-hourly-comparison.query.ts src/modules/kpi/presentation/query/whatsapp-tag-hourly-comparison.query.spec.ts src/modules/kpi/application/whatsapp-kpi-query.service.ts src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts test/kpi-whatsapp.e2e-spec.ts
git commit -m "feat: add branch filter to whatsapp kpis"
```

### Task 5: Update API docs and run final verification

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`
- Test: `D:\Projetos\sinapse3\test\kpi-budgets.e2e-spec.ts`
- Test: `D:\Projetos\sinapse3\test\kpi-sales.e2e-spec.ts`
- Test: `D:\Projetos\sinapse3\test\kpi-calls.e2e-spec.ts`
- Test: `D:\Projetos\sinapse3\test\kpi-whatsapp.e2e-spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-filters.query.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\sale-filters.query.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\sale-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-call-kpi.repository.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.spec.ts`

- [ ] **Step 1: Document `branchId` on every approved KPI route and add examples**

```md
- `branchId` optional, integer, single-select
- when present, only records attributable to the selected branch are returned
```

- [ ] **Step 2: Run the relevant backend verification suite**

Run: `npm test -- --runInBand src/modules/companies/application/branch-scope.service.spec.ts src/modules/kpi/presentation/query/budget-filters.query.spec.ts src/modules/kpi/presentation/query/sale-filters.query.spec.ts src/modules/kpi/application/budget-kpi-query.service.spec.ts src/modules/kpi/application/sale-kpi-query.service.spec.ts src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts test/kpi-budgets.e2e-spec.ts test/kpi-sales.e2e-spec.ts test/kpi-calls.e2e-spec.ts test/kpi-whatsapp.e2e-spec.ts`
Expected: PASS

- [ ] **Step 3: Run the broader backend suite if time allows**

Run: `npm test -- --runInBand`
Expected: PASS

- [ ] **Step 4: Review the final diff for accidental frontend or schema drift**

Run: `git diff --stat`
Expected: only KPI backend, company branch scope helper, tests, and REST docs changed

- [ ] **Step 5: Commit**

```bash
git add docs/api/rest-api.md
git commit -m "docs: document branch filter for kpis"
```
