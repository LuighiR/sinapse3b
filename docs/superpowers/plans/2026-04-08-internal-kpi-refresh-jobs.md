# Internal KPI Refresh Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the internal KPI refresh trigger into an asynchronous `refresh_jobs` workflow that responds with `202 Accepted` and exposes persisted job status by `jobId`.

**Architecture:** Replace the current synchronous internal refresh flow with a persisted job lifecycle in `core.refresh_jobs`. Keep the existing strict query validation and tenant resolution, but split the job logic into creation, execution, and status-query responsibilities so the API can acknowledge quickly and process `budgets`, `sales`, and `calls` in background while persisting final results in `results_json`.

**Tech Stack:** NestJS, TypeScript, Jest, Prisma schema mapping, SQL migrations, Zod

---

### Task 1: Add Refresh Job Persistence Schema

**Files:**
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/prisma/schema.prisma`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/prisma/schema.spec.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/prisma/migrations/20260408_add_core_refresh_jobs.sql`

- [ ] **Step 1: Write the failing schema test**

Add expectations in `prisma/schema.spec.ts` for a `RefreshJob` model with the approved fields and `@@schema("core")`.

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `npm test -- prisma/schema.spec.ts`
Expected: FAIL because `RefreshJob` is not modeled yet.

- [ ] **Step 3: Add the migration and Prisma model**

Create the SQL migration for `core.refresh_jobs` and add the matching Prisma model with `status`, `triggerType`, `resultsJson`, timestamps, and the tenant/client foreign keys or mapped ids that reflect the approved schema.

- [ ] **Step 4: Re-run the schema test**

Run: `npm test -- prisma/schema.spec.ts`
Expected: PASS.

### Task 2: Add Refresh Job Repository And Async Services

**Files:**
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job.repository.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-create.service.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-execute.service.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-status.service.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-create.service.spec.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-execute.service.spec.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job-status.service.spec.ts`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.ts`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/kpi.module.ts`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/kpi.module.spec.ts`

- [ ] **Step 1: Write the failing create-service tests**

Cover:
- valid job key creates a persisted job with `PENDING`
- accepted response includes `jobId`, `status = accepted`, and `message = task initiated`
- tenant resolution uses `tenant.backendClientId`
- invalid job key is rejected before persistence
- accepted jobs dispatch background execution after persistence without awaiting completion

- [ ] **Step 2: Run the create-service tests to verify they fail**

Run: `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-create.service.spec.ts`
Expected: FAIL because the create service does not exist yet.

- [ ] **Step 3: Write the failing execute-service tests**

Cover:
- job transitions from `PENDING` to `RUNNING`
- execution order is `budgets -> sales -> calls`
- a failure in one family does not stop the remaining families from running
- final status becomes `SUCCESS`, `PARTIAL_SUCCESS`, or `FAILED`
- `results_json`, `started_at`, `finished_at`, and optional `error_message` are persisted
- accepted jobs persist `trigger_type = api`

- [ ] **Step 4: Run the execute-service tests to verify they fail**

Run: `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-execute.service.spec.ts`
Expected: FAIL because the execute service does not exist yet.

- [ ] **Step 5: Write the failing status-service tests**

Cover:
- existing job status is mapped to API shape
- `results` is null for `PENDING` and `RUNNING`
- `startedAt`, `finishedAt`, and `errorMessage` follow the approved nullability rules
- unknown `jobId` returns `404`

- [ ] **Step 6: Run the status-service tests to verify they fail**

Run: `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-status.service.spec.ts`
Expected: FAIL because the status service does not exist yet.

- [ ] **Step 7: Implement repository and async services**

Add the repository contract and Prisma-backed implementation in `kpi.module.ts`. Split responsibilities into job creation, background execution, and persisted status query services. Keep the existing tenant resolver, but adapt it if needed to provide the exact persisted fields cleanly. The create path must trigger background execution after persistence, and the executor must emit the required acceptance, start, per-family, failure, and completion logs.

- [ ] **Step 8: Re-run the async-service tests**

Run:
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-create.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-execute.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-status.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- `npm test -- src/modules/kpi/kpi.module.spec.ts`
Expected: PASS.

### Task 3: Convert The Controller Contract To `202 + GET status`

**Files:**
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/presentation/internal-kpi-refresh-job.controller.ts`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/presentation/query/internal-kpi-refresh-job-id.param.ts`
- Create: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/presentation/query/internal-kpi-refresh-job-id.param.spec.ts`

- [ ] **Step 1: Write the failing controller tests**

Cover:
- `POST` returns `202` with `jobId`
- `GET` returns persisted status
- neither route requires `Authorization` or `X-Tenant-Id`
- invalid/missing `X-Job-Key` is rejected on both routes
- `404` and `409` mappings stay correct

- [ ] **Step 2: Run the controller tests to verify they fail**

Run: `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
Expected: FAIL because the controller still returns synchronous `200` behavior and has no `GET`.

- [ ] **Step 3: Write the failing job-id param parser tests**

Cover:
- accepts non-empty `jobId`
- rejects blank or malformed values that should not be routed to the status service

- [ ] **Step 4: Run the job-id parser tests to verify they fail**

Run: `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job-id.param.spec.ts`
Expected: FAIL because the parser does not exist yet.

- [ ] **Step 5: Implement the new controller contract**

Update the `POST` route to delegate to the create service and return `202`. Add `GET /internal/jobs/kpis/refresh/:jobId` delegating to the status service. Keep `slug/from/to` in query string and `X-Job-Key` in the header.

- [ ] **Step 6: Re-run the controller and parser tests**

Run:
- `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job-id.param.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`
Expected: PASS.

### Task 4: Update Documentation And Run Full Verification

**Files:**
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/docs/api/rest-api.md`
- Modify: `D:/Projetos/sinapse3/.worktrees/async-internal-kpi-refresh-jobs/src/modules/kpi/application/internal-kpi-refresh-job.service.ts` or replace usages if cleanup is needed

- [ ] **Step 1: Update the API docs**

Document:
- `POST /internal/jobs/kpis/refresh` now returns `202 Accepted`
- the response contains `task initiated` and `jobId`
- `GET /internal/jobs/kpis/refresh/:jobId` returns persisted job state
- the flow is automation-only, without JWT
- tenant slug resolves to backend `clientId`

- [ ] **Step 2: Run all targeted tests for the async slice**

Run:
- `npm test -- prisma/schema.spec.ts`
- `npm test -- src/config/env.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job-id.param.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-create.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-execute.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job-status.service.spec.ts`
- `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
- `npm test -- src/modules/kpi/kpi.module.spec.ts`

Expected: PASS.

- [ ] **Step 3: Run broader regression coverage**

Run: `npm test -- src/modules/kpi prisma/schema.spec.ts`
Expected: PASS with no regressions around the KPI module.

- [ ] **Step 4: Review diff and summarize operational caveats**

Check that the async background trigger, persisted job states, and `202` contract all match the approved spec. Call out that in-process background execution is intentionally simple and can later migrate to a queue without breaking the API contract.
