# Branch Telephony Domain Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move call ownership from `core.sinapse_clients.domain_uuid` to one telephony domain per `core.branches` row, so a tenant/client can import calls from all of its branch domains.

**Architecture:** `core.sinapse_clients` remains the operational client/tenant backend. `core.branches` becomes the owner of the telephony `domain_uuid`, and `core.call_facts` stores both `client_id` and `branch_id` during normalization. Call refresh keeps accepting `clientId`, but its raw import joins `raw.ferraco_calls.domain_uuid -> core.branches.telephony_domain_uuid -> core.branches.client_id`.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma 7, PostgreSQL, Jest

---

## Files

- Modify: `prisma/schema.prisma`
  - Add `Branch.telephonyDomainUuid String? @map("telephony_domain_uuid")`.
  - Add `Branch.callFacts CallFact[]`.
  - Add `CallFact.branchId Int? @map("branch_id")`.
  - Add `CallFact.branch Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull, onUpdate: Cascade)`.
  - Add indexes for branch-based call queries.
- Create: `prisma/migrations/<timestamp>_add_branch_telephony_domain_to_calls.sql`
  - Add `core.branches.telephony_domain_uuid`.
  - Add a unique partial index on active/non-null branch domain values if the database supports the intended invariant.
  - Add `core.call_facts.branch_id`.
  - Add FK from `core.call_facts.branch_id` to `core.branches(id)`.
  - Add call fact indexes for `(client_id, branch_id, started_at)` and branch-specific inbound metrics.
- Modify: `src/modules/normalization/application/call-normalization.service.ts`
  - Replace joins on `core.sinapse_clients.domain_uuid = raw.ferraco_calls.domain_uuid`.
  - Join through `core.branches.telephony_domain_uuid`.
  - Persist `branch_id` into `core.call_facts`.
  - Include `branchId` in raw record and write payload types.
- Modify: `src/modules/normalization/application/call-normalization.service.spec.ts`
  - Add tests proving multiple branch domains under one client are imported in the same client refresh.
  - Add tests proving unmatched domains are ignored.
  - Add tests proving `branchId` is written.
- Modify: `src/modules/kpi/application/call-kpi-refresh.service.ts`
  - Keep public refresh input as `clientId`.
  - Confirm no behavior assumes one client equals one telephony domain.
- Modify: `src/modules/kpi/infrastructure/prisma-call-kpi.repository.ts`
  - Prefer `call_facts.branch_id` for `branchId` filtering.
  - Keep employee/extension resolution for agent labels and non-commercial employee exclusions.
- Modify: `src/modules/kpi/infrastructure/prisma-call-kpi.repository.spec.ts`
  - Add or update tests showing branch filtering uses `callFact.branchId`.
  - Keep tests for agent name resolution.
- Modify: `docs/kpi-catalog.md` and `docs/api/rest-api.md`
  - Document that call import uses branch telephony domains.
  - Document that call branch filtering is fact-native after normalization.

## Task 1: Schema and Migration

- [ ] Add `telephonyDomainUuid` to `Branch` in `prisma/schema.prisma`.
- [ ] Add `branchId` and `branch` relation to `CallFact`.
- [ ] Add branch call fact indexes in the Prisma schema.
- [ ] Create the SQL migration with descriptive name.
- [ ] Review the generated/custom SQL before applying it.
- [ ] Do not drop or rewrite `core.sinapse_clients.domain_uuid` in this change; stop using it for call import first.

Expected SQL shape:

```sql
ALTER TABLE core.branches
ADD COLUMN IF NOT EXISTS telephony_domain_uuid text;

CREATE UNIQUE INDEX IF NOT EXISTS branches_telephony_domain_uuid_key
ON core.branches(telephony_domain_uuid)
WHERE telephony_domain_uuid IS NOT NULL;

ALTER TABLE core.call_facts
ADD COLUMN IF NOT EXISTS branch_id integer;

ALTER TABLE core.call_facts
ADD CONSTRAINT call_facts_branch_id_fkey
FOREIGN KEY (branch_id) REFERENCES core.branches(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS call_facts_client_branch_started_at_idx
ON core.call_facts(client_id, branch_id, started_at);
```

Run:

```bash
npm run prisma:generate
```

Expected: Prisma Client generation succeeds.

## Task 2: Normalize Calls Through Branch Domains

- [ ] Write a failing test in `call-normalization.service.spec.ts` for a client with two branch domains.
- [ ] Update `RawFerracoCallRecord` and `CallFactWritePayload` with `branchId`.
- [ ] Update `PrismaRawFerracoCallReader.countByClientId`.
- [ ] Update `PrismaRawFerracoCallReader.findByClientId`.
- [ ] Update `PrismaCallFactUpsertRepository.bulkUpsertClient`.
- [ ] Ensure `domainUuid` remains stored as the original telephony value for audit/debugging.
- [ ] Run the focused normalization test.

Core join shape:

```sql
FROM raw.ferraco_calls AS call
INNER JOIN core.branches AS branch
  ON branch.telephony_domain_uuid = call.domain_uuid
INNER JOIN core.sinapse_clients AS client
  ON client.id = branch.client_id
WHERE client.id = $1
```

Insert/select shape:

```sql
SELECT
  client.id,
  branch.id,
  'raw.ferraco_calls',
  call.id,
  call.domain_uuid,
  ...
```

Run:

```bash
npm test -- call-normalization.service.spec.ts
```

Expected: tests pass after implementation.

## Task 3: Make Branch Filtering Fact-Native

- [ ] Write a failing repository test showing `listCallFacts({ branchId })` filters by `callFact.branchId`.
- [ ] Update `CallFactRecord` if branch id needs to be carried through any in-memory path.
- [ ] Update `PrismaCallKpiRepository.listCallFacts` / branch path to query `core.call_facts.branch_id`.
- [ ] Preserve employee lookup for `employeeName`, extension labels, and non-commercial exclusions.
- [ ] Keep unmatched employee behavior only for agent labels, not for deciding whether a branch-owned call belongs to the branch.

Target behavior:

- Client-wide refresh includes all branch domains for the client.
- Branch filter includes all calls normalized with that `branch_id`.
- Agent ranking still resolves employee names from `extension_uuid` / extension number where possible.

Run:

```bash
npm test -- prisma-call-kpi.repository.spec.ts
```

Expected: repository tests pass, including old agent resolution tests and new branch id tests.

## Task 4: Refresh Flow Verification

- [ ] Add or update `call-kpi-refresh.service.spec.ts` only if refresh assumptions need explicit coverage.
- [ ] Verify `CallKpiRefreshService.refresh()` still calls `normalizeClientCalls(clientId)`.
- [ ] Verify materialization reads `call_facts` by `client_id`, not by domain.
- [ ] Run calls KPI service tests.

Run:

```bash
npm test -- call-kpi-refresh.service.spec.ts call-kpi-query.service.spec.ts
```

Expected: refresh and query tests pass.

## Task 5: Documentation and Manual Data Backfill Notes

- [ ] Update `docs/kpi-catalog.md` call pipeline section.
- [ ] Update `docs/api/rest-api.md` branch call behavior.
- [ ] Add a backfill note for production data:

```sql
UPDATE core.call_facts AS fact
SET branch_id = branch.id,
    updated_at = NOW()
FROM core.branches AS branch
WHERE fact.domain_uuid = branch.telephony_domain_uuid
  AND fact.client_id = branch.client_id
  AND fact.branch_id IS DISTINCT FROM branch.id;
```

- [ ] Confirm operational data has `core.branches.telephony_domain_uuid` populated before running call refresh in production.

## Final Verification

- [ ] Run focused tests:

```bash
npm test -- call-normalization.service.spec.ts prisma-call-kpi.repository.spec.ts call-kpi-refresh.service.spec.ts call-kpi-query.service.spec.ts
```

- [ ] Run full backend tests if focused tests pass:

```bash
npm test
```

- [ ] Run TypeScript build:

```bash
npm run build
```

## Rollout Notes

- Populate `core.branches.telephony_domain_uuid` for every branch before refreshing calls.
- Re-run call refresh for affected date ranges after deployment.
- Backfill existing `core.call_facts.branch_id` before relying on branch-filtered historical dashboards.
- Keep `core.sinapse_clients.domain_uuid` untouched until all call import and reporting paths no longer depend on it.
