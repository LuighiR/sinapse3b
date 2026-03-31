# Sales Drilldown Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /kpis/sales/drilldown` returning detailed sales rows for the requested period, with optional `sellerId`, `status`, and `orderType` filters.

**Architecture:** Mirror the existing budgets drilldown flow. Add a dedicated query parser in the presentation layer, expose a new controller route, extend the sales query service with a drilldown response contract plus row mapping/filtering, and teach the Prisma sales repository to fetch detailed `saleFact` rows.

**Tech Stack:** NestJS, Prisma, Jest, Supertest, TypeScript, Zod

---

### Task 1: Add failing parser coverage

**Files:**
- Create: `src/modules/kpi/presentation/query/sale-drilldown.query.ts`
- Create: `src/modules/kpi/presentation/query/sale-drilldown.query.spec.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal parser implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Add failing service coverage for sales drilldown

**Files:**
- Modify: `src/modules/kpi/application/sale-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/sale-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal service implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: Wire the endpoint and repository

**Files:**
- Modify: `src/modules/kpi/presentation/sales-kpi.controller.ts`
- Modify: `src/modules/kpi/kpi.module.ts`
- Modify: `test/kpi-sales.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e/controller test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Add controller and repository support**
- [ ] **Step 4: Run test to verify it passes**

### Task 4: Update API docs and verify focused suite

**Files:**
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Document the new endpoint and filters**
- [ ] **Step 2: Run focused Jest commands for parser, service, and e2e**
- [ ] **Step 3: Run any additional verification needed if failures surface**
