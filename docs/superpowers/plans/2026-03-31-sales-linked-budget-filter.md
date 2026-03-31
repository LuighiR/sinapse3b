# Sales Linked Budget Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `hasLinkedBudget` as a backend sales filter that applies consistently to all sales KPI endpoints backed by sale facts.

**Architecture:** Extend the shared sales filter parser so every sales endpoint can accept the new boolean flag. Thread the filter through the sales query service and Prisma repository selections, then verify the behavior with parser, service, and endpoint coverage.

**Tech Stack:** NestJS, Prisma, Jest, Supertest, TypeScript, Zod

---

### Task 1: Extend the shared sales filter parser

**Files:**
- Modify: `src/modules/kpi/presentation/query/sale-filters.query.ts`
- Modify: `src/modules/kpi/presentation/query/sale-drilldown.query.spec.ts`

- [ ] **Step 1: Write the failing parser tests for `hasLinkedBudget=true|false`**
- [ ] **Step 2: Run the parser test file and verify the new assertions fail for the expected reason**
- [ ] **Step 3: Add boolean parsing to the shared sales filter contract**
- [ ] **Step 4: Run the parser test file again and verify it passes**

### Task 2: Apply the filter across sales KPI queries

**Files:**
- Modify: `src/modules/kpi/application/sale-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/sale-kpi-refresh.service.ts`
- Modify: `src/modules/kpi/application/sale-kpi-query.service.spec.ts`
- Modify: `src/modules/kpi/kpi.module.ts`

- [ ] **Step 1: Write the failing service tests covering fact filtering and drilldown filter echoing**
- [ ] **Step 2: Run the service test file and verify the new assertions fail**
- [ ] **Step 3: Extend the fact record shape, fact filter checks, drilldown filters, and Prisma selection with `hasLinkedBudget`**
- [ ] **Step 4: Run the service test file again and verify it passes**

### Task 3: Verify endpoint wiring

**Files:**
- Modify: `test/kpi-sales.e2e-spec.ts`

- [ ] **Step 1: Write the failing endpoint assertions proving `hasLinkedBudget` is forwarded through sales endpoints**
- [ ] **Step 2: Run the sales e2e test file and verify the new assertions fail**
- [ ] **Step 3: Keep controller wiring on the shared parser path so all endpoints inherit the new filter**
- [ ] **Step 4: Run the sales e2e test file again and verify it passes**

### Task 4: Final verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run the focused backend Jest suite for parser, service, and sales e2e coverage**
- [ ] **Step 2: Run any extra verification needed if a regression appears**
- [ ] **Step 3: Summarize the shipped backend contract change and any remaining risks**
