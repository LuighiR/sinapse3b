# Budget Follow-Up DKW Employee Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-employee webhook routing to the DKW dispatch flow, using `core.employees.dkwWebhook` first and `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL` as the fallback.

**Architecture:** Keep the current dispatch endpoint and payload unchanged. Store the routing override on `core.employees`, enrich dispatch candidates with that value in the Prisma repository, and resolve the final destination URL inside the dispatch service before calling the webhook client.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Jest

---

## Planned File Structure

### Schema

- Modify: `D:\Projetos\sinapse3\prisma\schema.prisma`
- Create: `D:\Projetos\sinapse3\prisma\migrations\20260413_add_dkw_webhook_to_core_employees.sql`

### Application

- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.spec.ts`

### Infrastructure

- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\fetch-budget-follow-up-dkw-webhook.client.ts`

### Docs

- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

## Task 1: Add The Employee Webhook Schema

**Files:**
- Modify: `D:\Projetos\sinapse3\prisma\schema.prisma`
- Create: `D:\Projetos\sinapse3\prisma\migrations\20260413_add_dkw_webhook_to_core_employees.sql`

- [ ] Add nullable `dkwWebhook` to the Prisma `Employee` model, mapped to `dkw_webhook`
- [ ] Add a SQL migration that creates `core.employees.dkw_webhook`
- [ ] Keep the employee API untouched

## Task 2: Update The Dispatch Tests First

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`

- [ ] Add a service test that prefers `candidate.dkwWebhook` over env fallback
- [ ] Add a service test that falls back to env when `dkwWebhook` is missing
- [ ] Add a service test that falls back to env when `dkwWebhook` is blank
- [ ] Add a service test that records a normal failure when both URLs are unavailable
- [ ] Update the repository test fixture to include `dkwWebhook`

## Task 3: Implement URL Resolution

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-follow-up-dkw-dispatch.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\fetch-budget-follow-up-dkw-webhook.client.ts`

- [ ] Extend the dispatch candidate with `dkwWebhook`
- [ ] Change the webhook client contract to receive the target URL per send
- [ ] Resolve the final URL in the service with employee-first, env-second behavior
- [ ] Keep the current logging, send-state update, and three-consecutive-error behavior unchanged

## Task 4: Enrich Candidates With Employee Routing Data

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-budget-follow-up-dkw-dispatch.repository.ts`

- [ ] Join `core.employees` to the existing budget/raw query
- [ ] Use a branch-aware seller match so routing stays specific to the seller in that branch
- [ ] Return at most one employee webhook per candidate row

## Task 5: Verify And Document

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] Update docs to mention employee webhook priority and env fallback
- [ ] Run focused tests for the dispatch slice
- [ ] Run `npm test` for a fresh full verification pass
