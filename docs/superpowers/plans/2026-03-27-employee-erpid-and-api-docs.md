# Employee ERP Id And API Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor `erpId` em `GET /companies/current/employees` e alinhar `rest-api.md` com o significado real de `sellerId` em budgets/sales e com os filtros atuais de calls.

**Architecture:** A mudanca de comportamento fica concentrada em `EmployeesService`, que ja monta o payload do endpoint de employees. A documentacao passa a refletir o contrato atual dos endpoints, sem alterar o comportamento de budgets/sales.

**Tech Stack:** NestJS, TypeScript, Jest, Supertest, Markdown

---

### Task 1: Garantir o contrato do endpoint de employees

**Files:**
- Modify: `D:\Projetos\sinapse3\test\companies.e2e-spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\companies\application\employees.service.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the test to verify it fails**
- [ ] **Step 3: Add `erpId` to the employees payload**
- [ ] **Step 4: Run the test to verify it passes**

### Task 2: Sincronizar a documentacao REST

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Document `erpId` em `/companies/current/employees`**
- [ ] **Step 2: Explicar que `sellerId` em budgets/sales representa `employees.erp_id`**
- [ ] **Step 3: Atualizar a secao de calls para `extensionUuid` e `extensionNumber`**

### Task 3: Verificacao final

**Files:**
- Test: `D:\Projetos\sinapse3\test\companies.e2e-spec.ts`

- [ ] **Step 1: Rodar os testes relevantes**
- [ ] **Step 2: Revisar o diff final**
