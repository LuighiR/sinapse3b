# Calls Lost-Without-Employee Queues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include inbound lost calls to 3-digit queue destinations in `lostWithoutEmployee` / `withoutEmployee=true`, even when an Employee shares that `extensionNumber`.

**Architecture:** Change only `buildWithoutEmployeeFilter` in `PrismaCallKpiRepository`: keep excluding by unique Employee `extensionUuid`, but skip `/^\d{3}$/` values when building `agentExtensionNumber` / `agentResolutionKey` exclusion lists. Summary count and drilldown already share this helper. No schema, normalization, or API shape changes.

**Tech Stack:** NestJS, Prisma, Jest, TypeScript

**Spec:** `docs/superpowers/specs/2026-07-23-calls-lost-without-employee-queues-design.md`

---

## File map

| File | Responsibility |
| --- | --- |
| `src/modules/kpi/infrastructure/prisma-call-kpi.repository.ts` | `buildWithoutEmployeeFilter` — omit 3-digit extension numbers from Employee exclusion arms |
| `src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts` | Unit tests for count/drilldown without-employee Prisma `where` |
| `docs/api/rest-api.md` | Document queue exception on `lostWithoutEmployee` / `withoutEmployee` |
| `docs/kpi-catalog.md` | Same note in calls family catalog |

---

### Task 1: Failing tests for 3-digit exclusion skip

**Files:**
- Modify: `src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts`
- Test: `src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts`

- [ ] **Step 1: Update the existing count expectation that embeds 3-digit `104`**

In `it('counts lost inbound calls without a uniquely resolved employee'...)`, Employee Maria has `extensionNumber: '104'` and `extensionUuid: 'ext-1'`.

Change the expected `callFact.count` `where.NOT.OR` from:

```typescript
NOT: {
  OR: [
    { extensionUuid: { in: ['ext-1'] } },
    { agentExtensionNumber: { in: ['104'] } },
    { agentResolutionKey: { in: ['104'] } },
  ],
},
```

to:

```typescript
NOT: {
  OR: [{ extensionUuid: { in: ['ext-1'] } }],
},
```

- [ ] **Step 2: Add a focused failing test — Employee with only 3-digit number yields no number exclusion**

Append near the other without-employee tests:

```typescript
it('does not exclude lost calls by 3-digit employee extensionNumber in withoutEmployee filter', async () => {
  const prisma = {
    callFact: {
      count: jest.fn().mockResolvedValue(12),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Fila Comercial',
          extensionUuid: '',
          extensionNumber: '101',
        },
        {
          id: 2,
          name: 'Maria',
          extensionUuid: 'ext-maria',
          extensionNumber: '1041',
        },
      ]),
    },
  }

  const repository = new PrismaCallKpiRepository(prisma as any)

  await expect(
    repository.countLostWithoutEmployee({
      clientId: 'client-1',
      period: {
        from: utcDate(2026, 0, 5),
        to: utcDate(2026, 0, 5),
        key: '2026-01-05_2026-01-05',
        eachDay: () => [],
      } as any,
    }),
  ).resolves.toBe(12)

  expect(prisma.callFact.count).toHaveBeenCalledWith({
    where: {
      clientId: 'client-1',
      startedAt: expect.any(Object),
      direction: 'inbound',
      isLost: true,
      NOT: {
        OR: [
          { extensionUuid: { in: ['ext-maria'] } },
          { agentExtensionNumber: { in: ['1041'] } },
          { agentResolutionKey: { in: ['1041'] } },
        ],
      },
    },
  })
})
```

- [ ] **Step 3: Add drilldown assertion that withoutEmployee omits 3-digit numbers from NOT**

```typescript
it('omits 3-digit extensionNumbers from withoutEmployee drilldown exclusion', async () => {
  const prisma = {
    callFact: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Maria',
          extensionUuid: 'ext-1',
          extensionNumber: '104',
        },
      ]),
    },
  }

  const repository = new PrismaCallKpiRepository(prisma as any)

  await repository.getDrilldownPage({
    clientId: 'client-1',
    period: {
      from: utcDate(2026, 0, 5),
      to: utcDate(2026, 0, 5),
      key: '2026-01-05_2026-01-05',
      eachDay: () => [],
    } as any,
    withoutEmployee: true,
    outcome: 'UNANSWERED',
    direction: 'inbound',
    page: 1,
    pageSize: 50,
  })

  expect(prisma.callFact.count).toHaveBeenCalledWith({
    where: expect.objectContaining({
      direction: 'inbound',
      isLost: true,
      NOT: {
        OR: [{ extensionUuid: { in: ['ext-1'] } }],
      },
    }),
  })
})
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
npx jest src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts -t "withoutEmployee|without a uniquely resolved employee|3-digit"
```

Expected: FAIL — actual `where` still includes `{ agentExtensionNumber: { in: ['104'] } }` / `'101'` in exclusion lists.

- [ ] **Step 5: Commit failing tests**

```bash
git add src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts
git commit -m "test(calls): expect withoutEmployee to skip 3-digit extensionNumbers"
```

---

### Task 2: Implement filter change

**Files:**
- Modify: `src/modules/kpi/infrastructure/prisma-call-kpi.repository.ts` (around `buildWithoutEmployeeFilter`, ~lines 740–803)

- [ ] **Step 1: Filter 3-digit numbers out of exclusion list**

In `buildWithoutEmployeeFilter`, after computing `uniqueExtensionNumbers`, derive:

```typescript
const uniqueExtensionNumbersForExclusion = uniqueExtensionNumbers.filter(
  (extensionNumber) => !/^\d{3}$/.test(extensionNumber),
)
```

Replace the empty-check and number arms to use `uniqueExtensionNumbersForExclusion`:

```typescript
if (uniqueExtensionUuids.length === 0 && uniqueExtensionNumbersForExclusion.length === 0) {
  return {}
}

const matchedEmployeeFilters: Array<Record<string, unknown>> = []

if (uniqueExtensionUuids.length > 0) {
  matchedEmployeeFilters.push({ extensionUuid: { in: uniqueExtensionUuids } })
}

if (uniqueExtensionNumbersForExclusion.length > 0) {
  matchedEmployeeFilters.push({
    agentExtensionNumber: { in: uniqueExtensionNumbersForExclusion },
  })
  matchedEmployeeFilters.push({
    agentResolutionKey: { in: uniqueExtensionNumbersForExclusion },
  })
}

return {
  NOT: {
    OR: matchedEmployeeFilters,
  },
}
```

Do **not** add Prisma regex on call rows. Do **not** change `attachEmployeeNames` or ranking lookup.

Optional private helper for clarity (same file):

```typescript
private isQueueExtensionNumber(value: string): boolean {
  return /^\d{3}$/.test(value)
}
```

- [ ] **Step 2: Run repository tests**

Run:

```bash
npx jest src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts
```

Expected: PASS (all tests in the file).

- [ ] **Step 3: Run related call KPI unit tests**

Run:

```bash
npx jest src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

```bash
git add src/modules/kpi/infrastructure/prisma-call-kpi.repository.ts
git commit -m "fix(calls): keep 3-digit queues in lostWithoutEmployee filter"
```

---

### Task 3: Documentation

**Files:**
- Modify: `docs/api/rest-api.md` (around `lostWithoutEmployee` / `withoutEmployee` notes ~1771 and ~1872)
- Modify: `docs/kpi-catalog.md` (calls family rules / summary row)

- [ ] **Step 1: Update REST API notes**

Near `lostWithoutEmployee.count` / `withoutEmployee`, add:

```markdown
- chamadas inbound perdidas com `extension_uuid` vazio e ramal de exatamente 3 digitos (fila) entram em `withoutEmployee` / `lostWithoutEmployee` mesmo quando existe Employee com o mesmo `extensionNumber`; exclusao por `extensionUuid` de Employee continua valendo
```

Adjust the sentence that currently says only “nao resolvem para um Employee unico” so it mentions this queue exception.

- [ ] **Step 2: Update KPI catalog**

Under calls normalization (near the existing 3-digit queue bullet ~448) or summary metric semantics (~494), add one short bullet that `lostWithoutEmployee` / `withoutEmployee` includes those queue losses even when an Employee shares the same 3-digit `extensionNumber`, while Employee `extensionUuid` exclusion still applies.

- [ ] **Step 3: Commit docs**

```bash
git add docs/api/rest-api.md docs/kpi-catalog.md
git commit -m "docs(calls): note queue exception for lostWithoutEmployee"
```

---

### Task 4: Final verification

- [ ] **Step 1: Re-run focused suite**

```bash
npx jest src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts src/modules/kpi/application/call-kpi-query.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Manual check (optional, against deployed/dev tenant)**

```http
GET /kpis/calls/summary?from=2026-07-01&to=2026-07-23
GET /kpis/calls/drilldown?from=2026-07-01&to=2026-07-23&direction=inbound&outcome=UNANSWERED&withoutEmployee=true&page=1&pageSize=50
```

Expected: `lostWithoutEmployee.count` rises vs pre-fix; drilldown includes 3-digit destinations that already appeared under unanswered without `withoutEmployee`.

- [ ] **Step 3: Confirm git status is clean for intentional files**

```bash
git status
git log --oneline -5
```

---

## Done when

- [x] Spec approved: `docs/superpowers/specs/2026-07-23-calls-lost-without-employee-queues-design.md`
- [ ] `buildWithoutEmployeeFilter` skips `/^\d{3}$/` extension numbers in exclusion arms
- [ ] Unit tests cover 3-digit skip, 4+ digit keep, uuid keep
- [ ] Docs mention the queue exception
- [ ] No schema/normalization/API contract changes
