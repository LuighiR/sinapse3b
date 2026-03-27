# WhatsApp ChatId Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir filtro direto por `chatId` nas rotas analíticas de WhatsApp e filtro opcional por `sellerId` no comparison por tag para o lado de budgets.

**Architecture:** Os parsers passam a aceitar os novos query params, o `WhatsAppKpiQueryService` propaga filtros normalizados sem lookup de employees, e o `PrismaWhatsAppKpiRepository` aplica os filtros diretamente nas queries SQL. A documentação REST é atualizada para refletir o novo contrato.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL SQL, Jest, Supertest, Markdown

---

### Task 1: Cobrir o novo contrato HTTP com testes

**Files:**
- Modify: `D:\Projetos\sinapse3\test\kpi-whatsapp.e2e-spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.spec.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.spec.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.spec.ts`

- [ ] **Step 1: Escrever os testes de parser para `chatId` e `sellerId`**
- [ ] **Step 2: Escrever os testes de service para repasse dos novos filtros**
- [ ] **Step 3: Escrever os testes de e2e/controller para o novo contrato**
- [ ] **Step 4: Rodar os testes-alvo e confirmar que falham pelo motivo certo**

### Task 2: Implementar os novos filtros no backend

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\presentation\whatsapp-kpi.controller.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.ts`

- [ ] **Step 1: Implementar `chatId` opcional nos parsers de WhatsApp**
- [ ] **Step 2: Criar um input especifico para o comparison com `sellerId`**
- [ ] **Step 3: Propagar os filtros pelo controller e service**
- [ ] **Step 4: Aplicar os filtros SQL no repository**
- [ ] **Step 5: Rodar os testes-alvo e confirmar que passam**

### Task 3: Atualizar a documentacao publica

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Documentar `chatId` nas rotas analiticas de WhatsApp**
- [ ] **Step 2: Documentar `sellerId` opcional em `/kpis/whatsapp/tags/hourly/comparison`**
- [ ] **Step 3: Ajustar os exemplos de curl e semantica de filtro**

### Task 4: Verificacao final

**Files:**
- Test: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.spec.ts`
- Test: `D:\Projetos\sinapse3\test\kpi-whatsapp.e2e-spec.ts`

- [ ] **Step 1: Rodar a bateria relevante de backend**
- [ ] **Step 2: Revisar o diff final**
