# Calls Extension Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o filtro dos endpoints de calls para usar `extensionUuid` e `extensionNumber` diretamente, sem lookup por `sellerId`, preservando chamadas perdidas que só têm ramal.

**Architecture:** O contrato HTTP de calls deixa de aceitar `sellerId` e passa a aceitar `extensionUuid` e `extensionNumber`. O parser valida os dois campos como opcionais, e o `CallKpiQueryService` filtra `call_facts` diretamente por `extension_uuid`, `agent_extension_number` e `agent_resolution_key`, sem consultar `employees`.

**Tech Stack:** NestJS, TypeScript, Jest, Zod

---

### Task 1: Travar o novo contrato de filtro de calls

**Files:**
- Modify: `src/modules/kpi/application/call-kpi-query.service.spec.ts`
- Modify: `src/modules/kpi/presentation/query/call-filters.query.ts`

- [ ] **Step 1: Escrever testes que usem `extensionUuid` e `extensionNumber`**

Cobrir:
- filtro de summary com `extensionUuid` + `extensionNumber`
- filtro de ranking com `extensionUuid` + `extensionNumber`
- rejeição de `sellerId` nos parsers de calls

- [ ] **Step 2: Rodar os testes de calls para ver falhar**

Run: `npm test -- --runInBand src/modules/kpi/application/call-kpi-query.service.spec.ts`
Expected: FAIL por ainda existir dependência em `sellerId`

### Task 2: Ajustar contrato e implementação dos endpoints de calls

**Files:**
- Modify: `src/modules/kpi/application/call-kpi-query.service.ts`
- Modify: `src/modules/kpi/presentation/query/call-filters.query.ts`
- Modify: `src/modules/kpi/presentation/query/call-summary.query.ts`
- Modify: `src/modules/kpi/presentation/query/call-hourly.query.ts`
- Modify: `src/modules/kpi/presentation/query/call-hourly-comparison.query.ts`
- Modify: `src/modules/kpi/presentation/query/call-agent-ranking.query.ts`

- [ ] **Step 1: Remover `sellerId` do input de calls**

Trocar por:
- `extensionUuid?: string`
- `extensionNumber?: string`

- [ ] **Step 2: Remover lookup de employee**

Eliminar:
- `CallSellerFilterEmployee`
- `getEmployeeBySellerId`
- chamada ao repositório para resolver employee por seller

- [ ] **Step 3: Implementar filtro direto**

Regras:
- com `extensionUuid`, incluir fatos com `fact.extensionUuid === extensionUuid`
- com `extensionNumber`, incluir fatos com `fact.agentExtensionNumber === extensionNumber` ou `fact.agentResolutionKey === extensionNumber`
- com ambos, aceitar correspondência por qualquer um dos dois
- sem filtros, manter comportamento atual

- [ ] **Step 4: Rodar os testes de calls para ver passar**

Run: `npm test -- --runInBand src/modules/kpi/application/call-kpi-query.service.spec.ts`
Expected: PASS

### Task 3: Verificação final do contrato

**Files:**
- Modify: `src/modules/kpi/application/call-kpi-query.service.spec.ts`

- [ ] **Step 1: Rodar testes complementares do parser/fluxo de calls**

Run: `npm test -- --runInBand src/modules/kpi/application/call-kpi-query.service.spec.ts`
Expected: PASS

- [ ] **Step 2: Revisar diff final**

Run: `git diff -- src/modules/kpi/application/call-kpi-query.service.ts src/modules/kpi/application/call-kpi-query.service.spec.ts src/modules/kpi/presentation/query/call-filters.query.ts src/modules/kpi/presentation/query/call-summary.query.ts src/modules/kpi/presentation/query/call-hourly.query.ts src/modules/kpi/presentation/query/call-hourly-comparison.query.ts src/modules/kpi/presentation/query/call-agent-ranking.query.ts`
Expected: contrato de calls usando `extensionUuid` e `extensionNumber`, sem `sellerId`
