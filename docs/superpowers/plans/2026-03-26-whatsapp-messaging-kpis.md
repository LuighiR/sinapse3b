# WhatsApp Messaging KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-only WhatsApp and messaging KPI endpoints backed by canonical `core` conversational tables, using Prisma for schema mapping and SQL for analytical aggregations.

**Architecture:** Extend the existing KPI module with a query-only WhatsApp KPI slice. First map the conversational entities into Prisma without database migrations, then add a SQL-backed repository plus a query service for summary, ranking, hourly, and tag comparison outputs, and finally expose authenticated HTTP endpoints with focused unit and e2e tests.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Jest, Supertest, TypeScript

---

### Task 1: Map Canonical Conversational Tables in Prisma

**Files:**
- Modify: `D:\Projetos\sinapse3\prisma\schema.prisma`
- Modify: `D:\Projetos\sinapse3\prisma\schema.spec.ts`

- [ ] **Step 1: Write the failing Prisma schema expectations**

```typescript
it('maps the whatsapp conversational core tables', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8')

  expect(schema).toContain('model Session')
  expect(schema).toContain('model Message')
  expect(schema).toContain('model Ticket')
  expect(schema).toContain('model Contact')
  expect(schema).toContain('model Tag')
  expect(schema).toContain('model ContactTag')
  expect(schema).toContain('enum SessionType')
  expect(schema).toContain('enum MessageSenderType')
})
```

- [ ] **Step 2: Run the Prisma schema test to verify it fails**

Run: `npm test -- prisma/schema.spec.ts`
Expected: FAIL because the conversational models and enums are not mapped yet

- [ ] **Step 3: Add the minimal Prisma mappings without creating physical schema changes**

```prisma
model Session {
  id                String      @id
  ticketId          String      @map("ticket_id")
  type              SessionType
  startedAt         DateTime    @map("started_at")
  assignedUserName  String?     @map("assigned_user_name")
  assignedUserEmail String?     @map("assigned_user_email")
  ticket            Ticket      @relation(fields: [ticketId], references: [id])

  @@map("sessions")
  @@schema("core")
}
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npm run prisma:generate`
Expected: PASS with the new Prisma models and enums available in the generated client

- [ ] **Step 5: Re-run the Prisma schema test to verify it passes**

Run: `npm test -- prisma/schema.spec.ts`
Expected: PASS

### Task 2: Add the WhatsApp KPI Query Service with TDD

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\whatsapp-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing query-service tests**

```typescript
it('returns summary counts for conversations and received messages', async () => {})
it('returns ranking rows grouped by assigned user with an unassigned fallback', async () => {})
it('returns zero-filled session hourly rows', async () => {})
it('returns zero-filled message hourly rows for human received messages only', async () => {})
it('returns tag hourly rows for the selected tag', async () => {})
it('returns tag versus open budget hourly comparison rows', async () => {})
it('returns the available tags ordered by name', async () => {})
```

- [ ] **Step 2: Run the new unit test file to verify it fails**

Run: `npm test -- whatsapp-kpi-query.service.spec.ts`
Expected: FAIL because the query service does not exist yet

- [ ] **Step 3: Implement the minimal query service API and response types**

```typescript
export class WhatsAppKpiQueryService {
  async getSummary(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiSummaryResponse> { ... }
  async getAgentRanking(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiAgentRankingResponse> { ... }
  async getSessionsHourly(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiHourlyResponse> { ... }
  async getMessagesHourly(input: WhatsAppKpiQueryPeriodInput): Promise<WhatsAppKpiHourlyResponse> { ... }
  async listTags(input: WhatsAppKpiTagsInput): Promise<WhatsAppKpiTagListResponse> { ... }
  async getTagHourly(input: WhatsAppKpiTagHourlyInput): Promise<WhatsAppKpiHourlyResponse> { ... }
  async getTagHourlyComparison(input: WhatsAppKpiTagHourlyInput): Promise<WhatsAppKpiTagComparisonResponse> { ... }
}
```

- [ ] **Step 4: Re-run the unit tests to verify they still fail at the repository boundary**

Run: `npm test -- whatsapp-kpi-query.service.spec.ts`
Expected: FAIL because the repository implementation is still missing

### Task 3: Implement the SQL-Backed WhatsApp KPI Repository

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\infrastructure\prisma-whatsapp-kpi.repository.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`

- [ ] **Step 1: Write the failing repository-backed query service assertions**

```typescript
it('reads summary counts from canonical sessions and messages', async () => {})
it('reads ranking counts grouped by assigned user identity', async () => {})
it('joins sessions to tags through tickets and contact_tags', async () => {})
it('reads open budget hourly counts without linking records to tags', async () => {})
```

- [ ] **Step 2: Run the query-service tests to verify the repository gap is real**

Run: `npm test -- whatsapp-kpi-query.service.spec.ts`
Expected: FAIL because `PrismaWhatsAppKpiRepository` does not exist yet

- [ ] **Step 3: Implement the SQL aggregation repository**

```typescript
class PrismaWhatsAppKpiRepository implements WhatsAppKpiQueryRepository {
  async getSummary(...) { ... }
  async getAgentRankingRows(...) { ... }
  async getSessionsHourlyRows(...) { ... }
  async getMessagesHourlyRows(...) { ... }
  async listTags(...) { ... }
  async getTagHourlyRows(...) { ... }
  async getTagHourlyComparisonRows(...) { ... }
}
```

- [ ] **Step 4: Wire the repository into the KPI module**

```typescript
providers: [
  PrismaWhatsAppKpiRepository,
  {
    provide: WhatsAppKpiQueryService,
    useFactory: (repository: PrismaWhatsAppKpiRepository) => new WhatsAppKpiQueryService(repository),
    inject: [PrismaWhatsAppKpiRepository],
  },
]
```

- [ ] **Step 5: Re-run the query-service tests to verify they pass**

Run: `npm test -- whatsapp-kpi-query.service.spec.ts`
Expected: PASS

### Task 4: Expose the Authenticated HTTP Surface

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\whatsapp-kpi.controller.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-summary.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-agent-ranking.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-sessions-hourly.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-messages-hourly.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\whatsapp-tag-hourly-comparison.query.ts`
- Create: `D:\Projetos\sinapse3\test\kpi-whatsapp.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e tests for the WhatsApp KPI routes**

```typescript
it('returns the summary for the active tenant client', async () => {})
it('returns the agent ranking for the active tenant client', async () => {})
it('returns the session hourly series for the active tenant client', async () => {})
it('returns the message hourly series for the active tenant client', async () => {})
it('returns the available tags for the active tenant client', async () => {})
it('returns the selected tag hourly series for the active tenant client', async () => {})
it('returns the selected tag hourly comparison for the active tenant client', async () => {})
```

- [ ] **Step 2: Run the e2e test file to verify it fails**

Run: `npm test -- kpi-whatsapp.e2e-spec.ts`
Expected: FAIL because the controller and query parsers do not exist yet

- [ ] **Step 3: Implement the controller and query parsers**

```typescript
@Controller('kpis/whatsapp')
export class WhatsAppKpiController {
  @Get('summary')
  getSummary(...) { ... }

  @Get('agents/ranking')
  getAgentRanking(...) { ... }

  @Get('sessions/hourly')
  getSessionsHourly(...) { ... }

  @Get('messages/hourly')
  getMessagesHourly(...) { ... }

  @Get('tags')
  listTags(...) { ... }

  @Get('tags/hourly')
  getTagHourly(...) { ... }

  @Get('tags/hourly/comparison')
  getTagHourlyComparison(...) { ... }
}
```

- [ ] **Step 4: Register the controller in the KPI module**

```typescript
controllers: [KpiController, SalesKpiController, CallKpiController, WhatsAppKpiController]
```

- [ ] **Step 5: Re-run the e2e tests to verify they pass**

Run: `npm test -- kpi-whatsapp.e2e-spec.ts`
Expected: PASS

### Task 5: End-to-End Verification

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Document the new WhatsApp KPI routes if the API doc tracks KPI endpoints**

```markdown
- GET /kpis/whatsapp/summary
- GET /kpis/whatsapp/agents/ranking
- GET /kpis/whatsapp/sessions/hourly
- GET /kpis/whatsapp/messages/hourly
- GET /kpis/whatsapp/tags
- GET /kpis/whatsapp/tags/hourly
- GET /kpis/whatsapp/tags/hourly/comparison
```

- [ ] **Step 2: Run the focused backend verification suite**

Run: `npm test -- prisma/schema.spec.ts whatsapp-kpi-query.service.spec.ts kpi-whatsapp.e2e-spec.ts`
Expected: PASS

- [ ] **Step 3: Run the broader backend test suite if the focused verification passes**

Run: `npm test`
Expected: PASS or capture exact pre-existing failures if the full suite is not green
