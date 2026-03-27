# Budget Drilldown Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir `status` opcional em `GET /kpis/budgets/drilldown`, mantendo `from` e `to` obrigatorios e reaproveitando o endpoint existente.

**Architecture:** O parser do drilldown passa a aceitar `status`, o `BudgetKpiQueryService` aplica o filtro sobre as linhas do drilldown usando o mesmo mapeamento de status ja usado nos demais KPIs de budgets, e a documentacao REST e os testes sao atualizados para o novo contrato.

**Tech Stack:** NestJS, TypeScript, Jest, Supertest, Markdown

---

### Task 1: Cobrir o novo contrato com testes

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-drilldown.query.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\test\kpi-budgets.e2e-spec.ts`

- [ ] **Step 1: Escrever o teste de parser para `status` no drilldown**
- [ ] **Step 2: Escrever o teste de service para filtrar linhas do drilldown por status**
- [ ] **Step 3: Escrever o ajuste do teste e2e para o novo query param**
- [ ] **Step 4: Rodar os testes e confirmar que falham pelo motivo certo**

### Task 2: Implementar o filtro no endpoint existente

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-drilldown.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.ts`

- [ ] **Step 1: Adicionar `status` opcional ao parser do drilldown**
- [ ] **Step 2: Incluir `status` no objeto de filtros da resposta**
- [ ] **Step 3: Aplicar o filtro de status nas linhas retornadas pelo drilldown**
- [ ] **Step 4: Rodar os testes e confirmar que passam**

### Task 3: Sincronizar a documentacao REST

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Documentar `status` opcional no drilldown**
- [ ] **Step 2: Atualizar o exemplo de query e de `filters` no payload**

### Task 4: Verificacao final

**Files:**
- Test: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\budget-drilldown.query.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\budget-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\test\kpi-budgets.e2e-spec.ts`

- [ ] **Step 1: Rodar a bateria relevante**
- [ ] **Step 2: Revisar o diff final**
