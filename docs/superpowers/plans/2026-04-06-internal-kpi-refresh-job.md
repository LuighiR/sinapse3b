# Internal KPI Refresh Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-only endpoint protected by `X-Job-Key` that resolves one tenant by slug and refreshes budgets, sales, and calls for a requested period.

**Architecture:** Keep the public JWT-protected KPI routes unchanged. Add a strict internal query parser, a machine-job tenant resolver that maps `Tenant.slug` to `Tenant.backendClientId`, and an orchestration service that invokes the existing KPI refresh services directly and returns a per-step execution summary.

**Tech Stack:** NestJS, TypeScript, Jest, Prisma, Zod

---

### Task 1: Add Environment And Query Parsing Support

**Files:**
- Modify: `D:/Projetos/sinapse3/src/config/env.ts`
- Modify: `D:/Projetos/sinapse3/src/config/env.spec.ts`
- Modify: `D:/Projetos/sinapse3/.env.example`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.ts`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`

- [ ] **Step 1: Write the failing env test**

Add expectations for `INTERNAL_JOB_KEY` in `src/config/env.spec.ts`, including rejection of blank values.

- [ ] **Step 2: Run the env test to verify it fails**

Run: `npm test -- src/config/env.spec.ts`
Expected: FAIL because `INTERNAL_JOB_KEY` is missing from the parsed env shape.

- [ ] **Step 3: Write the failing parser tests**

Add tests for valid `slug/from/to`, invalid periods, and rejection of unexpected query params in `src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`.

- [ ] **Step 4: Run the parser test to verify it fails**

Run: `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`
Expected: FAIL because the parser file does not exist yet.

- [ ] **Step 5: Implement env and parser support**

Add `INTERNAL_JOB_KEY` to the env schema and sample env file. Implement a strict parser that accepts only `slug`, `from`, and `to`, validates through `KpiPeriod.between(...)`, and throws `BadRequestException` on invalid input.

- [ ] **Step 6: Re-run the env and parser tests**

Run:
- `npm test -- src/config/env.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`
Expected: PASS.

### Task 2: Add Machine-Job Tenant Resolution And Orchestration

**Files:**
- Create: `D:/Projetos/sinapse3/src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.ts`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/application/internal-kpi-refresh-job.service.ts`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/application/internal-kpi-refresh-job.service.spec.ts`
- Modify: `D:/Projetos/sinapse3/src/modules/kpi/kpi.module.ts`

- [ ] **Step 1: Write the failing tenant resolver tests**

Cover active tenant resolution, unknown slug, inactive tenant, missing `backendClientId`, and inactive backend client.

- [ ] **Step 2: Run the tenant resolver tests to verify they fail**

Run: `npm test -- src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
Expected: FAIL because the resolver does not exist yet.

- [ ] **Step 3: Write the failing orchestration service tests**

Cover:
- successful execution of `budgets -> sales -> calls`
- partial failure while continuing remaining steps
- `overallStatus` derivation
- use of `tenant.backendClientId` as `clientId`
- invalid `X-Job-Key` rejection
- operational logging for start, per-step progress, failures, and final status

- [ ] **Step 4: Run the orchestration service tests to verify they fail**

Run: `npm test -- src/modules/kpi/application/internal-kpi-refresh-job.service.spec.ts`
Expected: FAIL because the service does not exist yet.

- [ ] **Step 5: Implement the resolver and orchestration service**

Create a resolver that reads tenant and backend client by slug. Create an orchestration service that validates the job key using `loadEnv`, resolves the tenant, runs the three refresh services sequentially, captures timing and errors, and returns `success`, `partial_success`, or `failed`.

- [ ] **Step 6: Re-run the resolver and orchestration tests**

Run:
- `npm test -- src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job.service.spec.ts`
Expected: PASS.

### Task 3: Add Controller And Module Wiring

**Files:**
- Create: `D:/Projetos/sinapse3/src/modules/kpi/presentation/internal-kpi-refresh-job.controller.ts`
- Create: `D:/Projetos/sinapse3/src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
- Modify: `D:/Projetos/sinapse3/src/modules/kpi/kpi.module.ts`

- [ ] **Step 1: Write the failing controller tests**

Cover:
- service receives `X-Job-Key` and parsed query values
- missing key is rejected
- invalid key maps to `401/403`
- missing `Authorization` and `X-Tenant-Id` still allow the route to execute
- slug-not-found maps to `404`
- tenant configuration errors map to `409`
- partial refresh failures still return `200`
- valid route delegates correctly

- [ ] **Step 2: Run the controller tests to verify they fail**

Run: `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
Expected: FAIL because the controller does not exist yet.

- [ ] **Step 3: Implement controller and module wiring**

Add the controller route `POST /internal/jobs/kpis/refresh`, wire the new resolver and service providers, and keep the public KPI routes unchanged.

- [ ] **Step 4: Re-run the controller tests**

Run: `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`
Expected: PASS.

### Task 4: Verify The Full Slice

**Files:**
- Modify: `D:/Projetos/sinapse3/docs/api/rest-api.md`

- [ ] **Step 1: Run all targeted tests for the new slice**

Run:
- `npm test -- src/config/env.spec.ts`
- `npm test -- src/modules/kpi/presentation/query/internal-kpi-refresh-job.query.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-job-tenant-resolver.service.spec.ts`
- `npm test -- src/modules/kpi/application/internal-kpi-refresh-job.service.spec.ts`
- `npm test -- src/modules/kpi/presentation/internal-kpi-refresh-job.controller.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run a broader regression check**

Run: `npm test -- src/modules/kpi`
Expected: PASS with no regressions in nearby KPI tests.

- [ ] **Step 3: Update backend docs and review git diff**

Document the new endpoint, required `X-Job-Key`, automation-only scope, no JWT auth, slug-based tenant resolution, the `budgets/sales/calls` refresh families, and `overallStatus/results` response semantics.

- [ ] **Step 4: Summarize results and remaining risks**

Report the implemented files, test evidence, and any follow-up items such as scheduler wiring on the server.
