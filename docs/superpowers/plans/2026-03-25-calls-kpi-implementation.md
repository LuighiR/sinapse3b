# Calls KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend normalization, materialization, query, and HTTP surface for call KPIs backed by `raw.ferraco_calls` and `core.budget_facts`.

**Architecture:** Extend the existing normalization and KPI pipeline used for budgets and sales. First create a canonical call fact layer and Prisma schema support, then add call refresh/query services plus controller wiring, and finally cover the new behavior with focused unit and e2e tests.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Jest, Supertest, TypeScript

---

### Task 1: Add Call Fact Schema Support

**Files:**
- Modify: `D:\Projetos\sinapse3\prisma\schema.prisma`
- Create: `D:\Projetos\sinapse3\prisma\migrations\20260325_add_core_call_facts.sql`
- Test: `D:\Projetos\sinapse3\src\modules\normalization\application\call-normalization.service.spec.ts`

- [ ] **Step 1: Write the failing normalization schema-facing test**

```typescript
it('normalizes inbound calls into canonical call facts', async () => {
  const rawReader = {
    findByClientId: jest.fn().mockResolvedValue([
      {
        id: 1,
        clientId: 'client-1',
        domainUuid: 'domain-1',
        xmlCdrUuid: 'cdr-1',
        extensionUuid: 'ext-1',
        direction: 'inbound',
        callerNumber: '5551999999999',
        destinationNumber: '104',
        dateStart: '2026-01-10T09:15:00.000Z',
        dateFinal: '2026-01-10T09:20:00.000Z',
        duration: '300',
        hangupCause: 'NORMAL_CLEARING',
        sipHangupDisposition: 'send_bye',
        payload: { source: 'fixture' },
      },
    ]),
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- call-normalization.service.spec.ts`
Expected: FAIL because the call normalization files and types do not exist yet

- [ ] **Step 3: Add Prisma schema support for call facts**

```prisma
model CallFact {
  id                  BigInt   @id @default(autoincrement())
  clientId            String   @map("client_id")
  sourceTable         String   @map("source_table")
  sourceRecordId      Int      @map("source_record_id")
  domainUuid          String?  @map("domain_uuid")
  xmlCdrUuid          String?  @map("xml_cdr_uuid")
  direction           String?
  callerNumber        String?  @map("caller_number")
  destinationNumber   String?  @map("destination_number")
  extensionUuid       String?  @map("extension_uuid")
  startedAt           DateTime @map("started_at")
  endedAt             DateTime? @map("ended_at")
  durationSeconds     Decimal  @map("duration_seconds") @db.Decimal(19, 4)
  ...
}
```

- [ ] **Step 4: Add the SQL migration for `core.call_facts`**

```sql
CREATE TABLE core.call_facts (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES core.sinapse_clients(id),
  source_table TEXT NOT NULL,
  source_record_id INTEGER NOT NULL,
  domain_uuid TEXT,
  xml_cdr_uuid TEXT,
  direction TEXT,
  caller_number TEXT,
  destination_number TEXT,
  extension_uuid TEXT,
  started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITHOUT TIME ZONE,
  duration_seconds NUMERIC(19, 4) NOT NULL DEFAULT 0,
  hangup_cause TEXT,
  sip_hangup_disposition TEXT,
  is_inbound_to_company BOOLEAN NOT NULL DEFAULT FALSE,
  is_received BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost BOOLEAN NOT NULL DEFAULT FALSE,
  agent_resolution_type TEXT,
  agent_resolution_key TEXT,
  agent_extension_number TEXT,
  record_path TEXT,
  record_name TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT call_facts_client_source_record_key UNIQUE (client_id, source_table, source_record_id)
);
```

- [ ] **Step 5: Run Prisma generate to verify schema compiles**

Run: `npm run prisma:generate`
Expected: PASS with updated Prisma client

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260325_add_core_call_facts.sql
git commit -m "feat: add call fact schema and migration"
```

### Task 2: Implement Call Normalization with TDD

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\normalization\application\call-normalization.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\normalization\application\call-normalization.service.spec.ts`
- Modify: `D:\Projetos\sinapse3\src\modules\normalization\normalization.module.ts`

- [ ] **Step 1: Write the failing normalization tests**

```typescript
it('marks inbound extension calls as received when extension_uuid exists', async () => {})
it('marks recv_cancel inbound calls as lost and falls back to destination number', async () => {})
it('marks send_cancel inbound calls as lost when extension_uuid exists', async () => {})
it('marks send_refuse inbound calls as lost when extension_uuid exists', async () => {})
it('ignores outbound and local calls from the company inbound slice', async () => {})
it('ignores inbound rows whose destination is not a short numeric extension', async () => {})
```

- [ ] **Step 2: Run normalization tests to verify they fail**

Run: `npm test -- call-normalization.service.spec.ts`
Expected: FAIL with missing implementation or unmet assertions

- [ ] **Step 3: Write the minimal normalization implementation**

```typescript
export class CallNormalizationService {
  async normalizeClientCalls(clientId: string): Promise<CallNormalizationResult> {
    const calls = await this.rawReader.findByClientId(clientId)
    const normalized = calls.map((call) => this.normalizeCall(clientId, call))
    ...
  }
}
```

- [ ] **Step 4: Wire the service into the normalization module**

```typescript
providers: [
  ...,
  CallNormalizationService,
  PrismaRawFerracoCallReader,
  PrismaCallFactUpsertRepository,
]

exports: [CallNormalizationService]
```

- [ ] **Step 5: Run normalization tests to verify they pass**

Run: `npm test -- call-normalization.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/normalization/application/call-normalization.service.ts src/modules/normalization/application/call-normalization.service.spec.ts src/modules/normalization/normalization.module.ts
git commit -m "feat: add call normalization pipeline"
```

### Task 3: Add Call KPI Refresh and Query Services

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-refresh.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-refresh.service.spec.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing refresh tests**

```typescript
it('creates summary, hourly, ranking, and comparison materializations for calls', async () => {})
it('stores peak hour in the summary dimensions payload', async () => {})
```

- [ ] **Step 2: Run refresh tests to verify they fail**

Run: `npm test -- call-kpi-refresh.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write the failing query tests**

```typescript
it('returns summary cards from materialized call snapshots', async () => {})
it('falls back to call facts when materialized rows are missing', async () => {})
it('returns ranking rows with employee label fallback to extension', async () => {})
it('returns zero-filled hourly comparison rows', async () => {})
```

- [ ] **Step 4: Run query tests to verify they fail**

Run: `npm test -- call-kpi-query.service.spec.ts`
Expected: FAIL

- [ ] **Step 5: Implement the minimal refresh service**

```typescript
const summaryRows = this.buildSummaryRows(callFacts, telemarketingFacts)
const hourlyRows = this.buildHourlyRows(callFacts)
const rankingRows = this.buildRankingRows(callFacts)
const comparisonRows = this.buildHourlyComparisonRows(callFacts, telemarketingFacts)
```

- [ ] **Step 6: Implement the minimal query service**

```typescript
async getSummary(input: CallKpiQueryPeriodInput): Promise<CallKpiSummaryResponse> { ... }
async getHourly(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyResponse> { ... }
async getAgentRanking(input: CallKpiQueryPeriodInput): Promise<CallKpiAgentRankingResponse> { ... }
async getHourlyComparison(input: CallKpiQueryPeriodInput): Promise<CallKpiHourlyComparisonResponse> { ... }
```

- [ ] **Step 7: Run the new unit tests to verify they pass**

Run: `npm test -- call-kpi-refresh.service.spec.ts`
Expected: PASS

Run: `npm test -- call-kpi-query.service.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/kpi/application/call-kpi-refresh.service.ts src/modules/kpi/application/call-kpi-refresh.service.spec.ts src/modules/kpi/application/call-kpi-query.service.ts src/modules/kpi/application/call-kpi-query.service.spec.ts
git commit -m "feat: add call kpi services"
```

### Task 4: Wire Call KPI Repository and Availability Layer

**Files:**
- Modify: `D:\Projetos\sinapse3\src\modules\kpi\kpi.module.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-refresh.service.spec.ts`
- Test: `D:\Projetos\sinapse3\src\modules\kpi\application\call-kpi-query.service.spec.ts`

- [ ] **Step 1: Write the failing repository-integration tests**

```typescript
it('persists call summary, hourly, ranking, and comparison rows through the repository contract', async () => {})
it('reads call snapshots and breakdowns from the module repository layer', async () => {})
it('marks call KPI availability after refresh', async () => {})
```

- [ ] **Step 2: Run the service tests to verify they still fail for repository reasons**

Run: `npm test -- call-kpi-refresh.service.spec.ts`
Expected: FAIL because the repository wiring and persistence implementation do not exist yet

Run: `npm test -- call-kpi-query.service.spec.ts`
Expected: FAIL because the repository read layer does not exist yet

- [ ] **Step 3: Add the concrete call KPI repository and availability wiring**

```typescript
class PrismaCallKpiRepository implements CallKpiRefreshRepository, CallKpiQueryRepository, CallKpiAvailabilityRepository {
  async ensureDefinitions() { ... }
  async listCallFacts(...) { ... }
  async listTelemarketingBudgetFacts(...) { ... }
  async persistMaterialization(...) { ... }
  async getSummaryRows(...) { ... }
  async getHourlyRows(...) { ... }
  async getAgentRankingRows(...) { ... }
  async getHourlyComparisonRows(...) { ... }
}
```

- [ ] **Step 4: Run the service tests to verify the repository-backed implementations pass**

Run: `npm test -- call-kpi-refresh.service.spec.ts`
Expected: PASS

Run: `npm test -- call-kpi-query.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/kpi.module.ts
git commit -m "feat: add call kpi repository wiring"
```

### Task 5: Wire HTTP Endpoints

**Files:**
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\call-kpi.controller.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-summary.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-hourly.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-agent-ranking.query.ts`
- Create: `D:\Projetos\sinapse3\src\modules\kpi\presentation\query\call-hourly-comparison.query.ts`
- Create: `D:\Projetos\sinapse3\test\kpi-calls.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e tests for call routes**

```typescript
it('returns call summary for the active tenant client', async () => {})
it('returns hourly call rows for the active tenant client', async () => {})
it('returns agent ranking rows for the active tenant client', async () => {})
it('returns hourly comparison rows for the active tenant client', async () => {})
it('refreshes call kpis for the active tenant client', async () => {})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `npm test -- kpi-calls.e2e-spec.ts`
Expected: FAIL because the routes and provider wiring do not exist yet

- [ ] **Step 3: Add repository wiring and controller endpoints**

```typescript
@Controller('kpis/calls')
export class CallKpiController {
  @Post('refresh')
  refreshCalls(...) { ... }

  @Get('summary')
  getSummary(...) { ... }

  @Get('hourly')
  getHourly(...) { ... }

  @Get('agents/ranking')
  getAgentRanking(...) { ... }

  @Get('hourly/comparison')
  getHourlyComparison(...) { ... }
}
```

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `npm test -- kpi-calls.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/presentation/call-kpi.controller.ts src/modules/kpi/presentation/query/call-summary.query.ts src/modules/kpi/presentation/query/call-hourly.query.ts src/modules/kpi/presentation/query/call-agent-ranking.query.ts src/modules/kpi/presentation/query/call-hourly-comparison.query.ts test/kpi-calls.e2e-spec.ts
git commit -m "feat: expose call kpi endpoints"
```

### Task 6: End-to-End Verification

**Files:**
- Modify: `D:\Projetos\sinapse3\docs\api\rest-api.md`

- [ ] **Step 1: Document the new call KPI endpoints if the API doc already tracks the KPI routes**

```markdown
- GET /kpis/calls/summary
- GET /kpis/calls/hourly
- GET /kpis/calls/agents/ranking
- GET /kpis/calls/hourly/comparison
- POST /kpis/calls/refresh
```

- [ ] **Step 2: Run the focused backend test suite**

Run: `npm test -- call-normalization.service.spec.ts call-kpi-refresh.service.spec.ts call-kpi-query.service.spec.ts kpi-calls.e2e-spec.ts`
Expected: PASS

- [ ] **Step 3: Run the broader project test suite if the focused tests pass cleanly**

Run: `npm test`
Expected: PASS or report pre-existing failures with exact evidence

- [ ] **Step 4: Commit**

```bash
git add docs/api/rest-api.md
git commit -m "docs: document call kpi endpoints"
```
