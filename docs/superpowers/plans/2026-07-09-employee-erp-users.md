# Employee ERP Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalizar `Employee` ↔ usuários ERP em `core.employee_erp_users`, migrar `employees.erp_id`, expor `erpUsers` na API e ajustar lookups de normalização/DKW.

**Architecture:** Nova tabela de vínculo com `clientId` desnormalizado e `@@unique([clientId, erpId])`. `Employee.branchId` continua como filial de residência; cada vínculo carrega a filial atendida. Lookups de budgets/sales/DKW passam a usar `employee_erp_users.erp_id` + `branch_id` do vínculo. API híbrida: GET employees inclui `erpUsers[]`; CRUD de vínculos em endpoints dedicados.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, Jest, Supertest

**Spec:** `docs/superpowers/specs/2026-07-09-employee-erp-users-design.md`

**Deploy note:** Aplicar migration e código na mesma release. A migration cria a tabela, falha se houver `erp_id` duplicado no mesmo cliente, faz backfill e só então dropa `employees.erp_id`. Código antigo que lê `employees.erp_id` quebra se a migration rodar sem o deploy do código.

---

## File Structure

### Schema / migration
- Modify: `prisma/schema.prisma` — model `EmployeeErpUser`; remover `erpId` de `Employee`; relations em `Branch` e `SinapseClient`
- Create: `prisma/migrations/20260709_add_employee_erp_users.sql`
- Modify: `prisma/schema.spec.ts`

### Companies / employees API
- Modify: `src/modules/companies/application/employees.service.ts`
- Create: `src/modules/companies/application/employee-erp-users.service.ts`
- Create: `src/modules/companies/application/employee-erp-users.service.spec.ts`
- Modify: `src/modules/companies/presentation/companies.controller.ts`
- Create: `src/modules/companies/presentation/body/create-employee-erp-user.body.ts`
- Modify: `src/modules/companies/companies.module.ts`
- Modify: `test/helpers/fakes.ts`
- Modify: `test/companies.e2e-spec.ts`

### Normalization
- Modify: `src/modules/normalization/application/employee-branch-lookup.service.ts`
- Modify: `src/modules/normalization/application/budget-normalization.service.ts` (CTE `employee_branch_lookup`)
- Modify: `src/modules/normalization/application/sale-normalization.service.ts` (CTE espelhada)
- Modify: `src/modules/normalization/application/budget-normalization.service.spec.ts`
- Modify: `src/modules/normalization/application/sale-normalization.service.spec.ts`

### DKW
- Modify: `src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.ts`
- Modify: `src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts` (assert SQL contém join em `employee_erp_users`)

### Docs
- Modify: `docs/api/rest-api.md` — employees payload + todas as menções `sellerId` → `core.employees.erp_id`

---

### Task 1: Schema Prisma + migration SQL

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260709_add_employee_erp_users.sql`
- Modify: `prisma/schema.spec.ts`

- [ ] **Step 1: Write failing schema spec**

Em `prisma/schema.spec.ts`, adicionar:

```ts
it('models employee ERP users and removes erpId from Employee', () => {
  const schema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8')

  expect(schema).toContain('model EmployeeErpUser')
  expect(schema).toContain('@@unique([clientId, erpId]')
  expect(schema).toContain('@@map("employee_erp_users")')
  expect(schema).toMatch(/model Employee \{[^}]*branchId/s)
  expect(schema).not.toMatch(/model Employee \{[^}]*erpId/s)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest prisma/schema.spec.ts -t "employee ERP users"`
Expected: FAIL (model ainda não existe / `erpId` ainda em Employee)

- [ ] **Step 3: Update Prisma schema**

Em `Employee`: remover `erpId`; adicionar `erpUsers EmployeeErpUser[]`.

Em `Branch`: adicionar `employeeErpUsers EmployeeErpUser[]`.

Em `SinapseClient`: adicionar `employeeErpUsers EmployeeErpUser[]`.

Adicionar model:

```prisma
model EmployeeErpUser {
  id         Int           @id @default(autoincrement())
  employeeId Int           @map("employee_id")
  clientId   String        @map("client_id")
  erpId      BigInt        @map("erp_id")
  branchId   Int           @map("branch_id")
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")
  employee   Employee      @relation(fields: [employeeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  client     SinapseClient @relation(fields: [clientId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  branch     Branch        @relation(fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([clientId, erpId], map: "employee_erp_users_client_erp_id_key")
  @@index([employeeId], map: "employee_erp_users_employee_id_idx")
  @@index([branchId], map: "employee_erp_users_branch_id_idx")
  @@index([erpId, branchId], map: "employee_erp_users_erp_id_branch_id_idx")
  @@map("employee_erp_users")
  @@schema("core")
}
```

- [ ] **Step 4: Create SQL migration**

Arquivo `prisma/migrations/20260709_add_employee_erp_users.sql`:

```sql
-- 1) Create table
CREATE TABLE core.employee_erp_users (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  client_id TEXT NOT NULL REFERENCES core.sinapse_clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  erp_id BIGINT NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES core.branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_erp_users_client_erp_id_key UNIQUE (client_id, erp_id)
);

CREATE INDEX employee_erp_users_employee_id_idx ON core.employee_erp_users (employee_id);
CREATE INDEX employee_erp_users_branch_id_idx ON core.employee_erp_users (branch_id);
CREATE INDEX employee_erp_users_erp_id_branch_id_idx ON core.employee_erp_users (erp_id, branch_id);

-- 2) Fail on duplicate erp_id within the same client
DO $$
DECLARE
  dup_report TEXT;
BEGIN
  SELECT string_agg(
    format('client=%s erp_id=%s employees=%s', client_id, erp_id, employee_ids),
    E'\n'
  )
  INTO dup_report
  FROM (
    SELECT
      b.client_id,
      e.erp_id,
      string_agg(e.id::text, ',' ORDER BY e.id) AS employee_ids
    FROM core.employees e
    JOIN core.branches b ON b.id = e.branch_id
    GROUP BY b.client_id, e.erp_id
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_report IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot migrate employees.erp_id: duplicate erp_id within client:%s%s', E'\n', dup_report;
  END IF;
END $$;

-- 3) Backfill
INSERT INTO core.employee_erp_users (employee_id, client_id, erp_id, branch_id)
SELECT e.id, b.client_id, e.erp_id, e.branch_id
FROM core.employees e
JOIN core.branches b ON b.id = e.branch_id;

-- 4) Drop old column
ALTER TABLE core.employees DROP COLUMN erp_id;
```

- [ ] **Step 5: Regenerate Prisma client**

Run: `npm run prisma:generate`
Expected: client regenerado com `EmployeeErpUser` e sem `Employee.erpId`

Sem este passo, Tasks 2–3 quebram em TypeScript / client desatualizado.

- [ ] **Step 6: Run schema spec**

Run: `npx jest prisma/schema.spec.ts -t "employee ERP users"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/schema.spec.ts prisma/migrations/20260709_add_employee_erp_users.sql
git commit -m "feat(schema): add employee_erp_users and migrate erp_id"
```

---

### Task 2: GET employees devolve `erpUsers[]`

**Files:**
- Modify: `test/companies.e2e-spec.ts`
- Modify: `test/helpers/fakes.ts`
- Modify: `src/modules/companies/application/employees.service.ts`

- [ ] **Step 1: Update fixtures type**

Em `test/helpers/fakes.ts`, em `TestEmployee`:

- Remover `erpId?: bigint`
- Adicionar `erpUsers?: Array<{ id: number; erpId: bigint; branchId: number }>`

- [ ] **Step 2: Write failing e2e expectation**

No teste `returns employees for the current company...` em `test/companies.e2e-spec.ts`:

- Trocar fixtures de employees para usar `erpUsers` em vez de `erpId` no topo
- Expectativa sem `erpId` no topo; com `erpUsers: [{ id, erpId, branchId }]`

Exemplo de fixture:

```ts
{
  id: 20,
  name: 'Maria Silva',
  branchId: 10,
  extensionNumber: '101',
  extensionUuid: 'ext-101',
  chatId: 'chat-20',
  isNonCommercial: true,
  erpUsers: [{ id: 1, erpId: 500n, branchId: 10 }],
}
```

Expectativa:

```ts
{
  id: 20,
  name: 'Maria Silva',
  branchId: 10,
  extensionNumber: '101',
  extensionUuid: 'ext-101',
  chatId: 'chat-20',
  isNonCommercial: true,
  erpUsers: [{ id: 1, erpId: 500, branchId: 10 }],
}
```

- [ ] **Step 3: Run e2e to verify fail**

Run: `npx jest --config test/jest-e2e.json test/companies.e2e-spec.ts -t "returns employees"`
Expected: FAIL (payload ainda tem `erpId` / sem `erpUsers`)

- [ ] **Step 4: Update `EmployeesService`**

Tipos:

```ts
export type EmployeeErpUserSummary = {
  id: number
  erpId: number
  branchId: number
}

export type EmployeeSummary = {
  id: number
  name: string
  branchId: number
  extensionNumber: string
  extensionUuid: string
  chatId: string
  isNonCommercial: boolean
  erpUsers: EmployeeErpUserSummary[]
}
```

Fixtures path: mapear `employee.erpUsers ?? []` com `serializeErpId`.

Prisma path: `findMany` com

```ts
select: {
  id: true,
  name: true,
  extensionNumber: true,
  extensionUuid: true,
  chatId: true,
  isNonCommercial: true,
  branchId: true,
  erpUsers: {
    select: { id: true, erpId: true, branchId: true },
    orderBy: { id: 'asc' },
  },
},
```

Mapear `erpUsers` serializando cada `erpId` com `serializeErpId`. Remover `erpId` do topo.

- [ ] **Step 5: Run e2e to verify pass**

Run: `npx jest --config test/jest-e2e.json test/companies.e2e-spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add test/helpers/fakes.ts test/companies.e2e-spec.ts src/modules/companies/application/employees.service.ts
git commit -m "feat(companies): return erpUsers on employees list"
```

---

### Task 3: Service + endpoints de vínculos ERP

**Files:**
- Create: `src/modules/companies/application/employee-erp-users.service.ts`
- Create: `src/modules/companies/application/employee-erp-users.service.spec.ts`
- Create: `src/modules/companies/presentation/body/create-employee-erp-user.body.ts`
- Modify: `src/modules/companies/presentation/companies.controller.ts`
- Modify: `src/modules/companies/companies.module.ts`
- Modify: `test/companies.e2e-spec.ts`

- [ ] **Step 1: Write unit tests do service (failing)**

Em `employee-erp-users.service.spec.ts`, cobrir com mocks de Prisma:

1. `listForEmployee` — employee do tenant → lista; employee outro tenant → `NotFoundException`
2. `create` — sucesso; branch outro tenant → `BadRequestException`; `erpId` já existente no client → `ConflictException`
3. `remove` — sucesso; vínculo de outro employee → `NotFoundException`

Usar `NotFoundException`, `BadRequestException`, `ConflictException` de `@nestjs/common`.

- [ ] **Step 2: Run unit tests to verify fail**

Run: `npx jest src/modules/companies/application/employee-erp-users.service.spec.ts`
Expected: FAIL (módulo/service inexistente)

- [ ] **Step 3: Implement `EmployeeErpUsersService`**

Contrato:

```ts
listForEmployee(clientId: string, employeeId: number): Promise<EmployeeErpUserSummary[]>
create(clientId: string, employeeId: number, input: { erpId: number; branchId: number }): Promise<EmployeeErpUserSummary>
remove(clientId: string, employeeId: number, erpUserId: number): Promise<void>
```

Regras:

- Resolver employee com `where: { id: employeeId, branch: { clientId } }` → senão `404`
- Resolver branch com `where: { id: branchId, clientId }` → senão `400`
- Antes do create: `findFirst({ where: { clientId, erpId: BigInt(erpId) } })` → se existir, `409`
- Create grava `{ employeeId, clientId, erpId: BigInt(erpId), branchId }`
- Delete: `deleteMany`/`findFirst` com `{ id: erpUserId, employeeId, clientId }` → senão `404`

Manter `serializeErpId` (pode extrair para helper compartilhado com `employees.service.ts` se evitar duplicação óbvia; senão duplicar a função pequena).

- [ ] **Step 4: Body parser**

`create-employee-erp-user.body.ts` com zod (mesmo padrão de `employees.query.ts`):

```ts
{ erpId: number (int positivo), branchId: number (int positivo) }
```

Invalid → `BadRequestException`.

- [ ] **Step 5: Wire controller + module**

Em `CompaniesController`:

```ts
@Get('current/employees/:employeeId/erp-users')
@Post('current/employees/:employeeId/erp-users')
@Delete('current/employees/:employeeId/erp-users/:erpUserId')
```

Parse `employeeId` / `erpUserId` como inteiros positivos; inválido → `400`.

Registrar `EmployeeErpUsersService` em `companies.module.ts`.

- [ ] **Step 6: E2E via fixtures mutáveis**

O harness e2e usa fixtures in-memory (`AUTH_TEST_FIXTURES`), não Prisma real. Estender `EmployeeErpUsersService` com path de fixtures (mesmo padrão de `EmployeesService.listFromFixtures`) para mutar `employee.erpUsers` em memória:

- GET: lista `erpUsers` do employee no tenant
- POST: append com check de conflito por `clientId`+`erpId` (via branches do fixture)
- DELETE: remove por `id`; `404` se não achar

Casos e2e mínimos em `test/companies.e2e-spec.ts`:

1. GET `/companies/current/employees/20/erp-users` → array
2. POST com `erpId` já usado → `409`
3. DELETE vínculo inexistente → `404`

Unit spec continua cobrindo o path Prisma com mocks.

- [ ] **Step 7: Run tests**

Run:

```bash
npx jest src/modules/companies/application/employee-erp-users.service.spec.ts
npx jest --config test/jest-e2e.json test/companies.e2e-spec.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/companies test/companies.e2e-spec.ts test/helpers/fakes.ts
git commit -m "feat(companies): add employee ERP user link endpoints"
```

---

### Task 4: Normalization lookups → `employee_erp_users`

**Files:**
- Modify: `src/modules/normalization/application/employee-branch-lookup.service.ts`
- Modify: `src/modules/normalization/application/budget-normalization.service.ts`
- Modify: `src/modules/normalization/application/sale-normalization.service.ts`
- Modify: `src/modules/normalization/application/budget-normalization.service.spec.ts`
- Modify: `src/modules/normalization/application/sale-normalization.service.spec.ts`

- [ ] **Step 1: Update failing expectations nos specs**

Trocar asserts `e.erp_id` / `FROM core.employees` do CTE de lookup para esperar `employee_erp_users` (ex.: `eu.erp_id`, `FROM core.employee_erp_users`).

- [ ] **Step 2: Run specs to verify fail**

Run:

```bash
npx jest src/modules/normalization/application/budget-normalization.service.spec.ts
npx jest src/modules/normalization/application/sale-normalization.service.spec.ts
```

Expected: FAIL

- [ ] **Step 3: Update `PrismaEmployeeBranchLookupReader`**

Como `erpId` é único por cliente, lookup 1:1:

```sql
SELECT
  eu.erp_id AS "sellerId",
  eu.branch_id AS "branchId",
  b.name AS "branchName"
FROM core.employee_erp_users AS eu
JOIN core.branches AS b ON b.id = eu.branch_id
WHERE eu.client_id = ${clientId}
ORDER BY eu.erp_id ASC
```

- [ ] **Step 4: Update CTEs em budget/sale normalization**

Substituir o CTE `employee_branch_lookup` por:

```sql
WITH employee_branch_lookup AS (
  SELECT
    eu.erp_id AS seller_id,
    eu.branch_id AS branch_id,
    b.name AS branch_name
  FROM core.employee_erp_users AS eu
  JOIN core.branches AS b ON b.id = eu.branch_id
  WHERE eu.client_id = ${clientId}
)
```

(remover `GROUP BY` / `CASE WHEN count(*) = 1` — não são mais necessários)

- [ ] **Step 5: Run normalization specs**

Run:

```bash
npx jest src/modules/normalization/application/budget-normalization.service.spec.ts
npx jest src/modules/normalization/application/sale-normalization.service.spec.ts
```

Os specs de budget/sale já inspecionam o SQL do CTE. Se quiser cobertura direta do reader, criar `employee-branch-lookup.service.spec.ts` mínimo assertando que `$queryRaw` referencia `employee_erp_users` — opcional.

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/normalization
git commit -m "feat(normalization): resolve seller branch via employee_erp_users"
```

---

### Task 5: DKW dispatch match via vínculo atendido

**Files:**
- Modify: `src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.ts`
- Modify: `src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`

- [ ] **Step 1: Strengthen repository spec**

Além do mock de retorno, capturar o SQL passado a `$queryRaw` e assertar:

```ts
expect(sqlText).toContain('employee_erp_users')
expect(sqlText).toContain('eu.erp_id = fact.seller_id')
expect(sqlText).toContain('eu.branch_id = fact.branch_id')
expect(sqlText).not.toContain('employees.erp_id')
```

(ajustar aliases conforme a query final)

- [ ] **Step 2: Run to verify fail**

Run: `npx jest src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`
Expected: FAIL

- [ ] **Step 3: Update LATERAL join**

Substituir o match atual por:

```sql
LEFT JOIN LATERAL (
  SELECT e.dkw_webhook
  FROM core.employee_erp_users AS eu
  JOIN core.employees AS e ON e.id = eu.employee_id
  WHERE eu.erp_id = fact.seller_id
    AND eu.branch_id = fact.branch_id
    AND eu.client_id = fact.client_id
  ORDER BY eu.id ASC
  LIMIT 1
) AS employee
  ON TRUE
```

Webhook continua vindo de `employees.dkw_webhook` via o vínculo (filial **atendida**, não residência).

- [ ] **Step 4: Run spec**

Run: `npx jest src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.ts src/modules/kpi/infrastructure/prisma-budget-follow-up-dkw-dispatch.repository.spec.ts
git commit -m "fix(kpi): match DKW webhook via employee_erp_users attended branch"
```

---

### Task 6: Documentação REST + verificação final

**Files:**
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Update employees section**

Em `GET /companies/current/employees`:

- Remover `erpId` do exemplo
- Documentar `erpUsers: [{ id, erpId, branchId }]`
- Explicar: `branchId` do employee = residência; `erpUsers[].branchId` = filial atendida

Documentar novos endpoints:

- `GET/POST /companies/current/employees/:employeeId/erp-users`
- `DELETE /companies/current/employees/:employeeId/erp-users/:erpUserId`

Incluir erros `400` / `404` / `409`.

- [ ] **Step 2: Replace sellerId origin docs**

Buscar/substituir em `docs/api/rest-api.md` todas as ocorrências de:

`core.employees.erp_id` → `core.employee_erp_users.erp_id`

(manter menção a `budget_facts.seller_id` / `sale_facts.seller_id` onde já existir)

- [ ] **Step 3: Grep residual `employees.erpId` / `employees.erp_id` no código**

Run:

```bash
rg "employees\.erp_id|employee\.erpId|erpId: true" src test prisma --glob '!**/migrations/**'
```

Corrigir qualquer consumidor restante (exceto `Branch.erpId` e docs históricas em `docs/superpowers/specs` antigas — não reescrever specs passadas).

- [ ] **Step 4: Full test pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/api/rest-api.md
git commit -m "docs(api): document employee ERP users and sellerId source"
```

---

## Implementation Notes

- **Sem PATCH de vínculo** — fora de escopo; remover e recriar.
- **Filtro `branchId` em GET employees** — continua residência (`employees.branch_id`).
- **Duplicatas no backfill** — migration aborta; corrigir dados manualmente antes de reaplicar.
- **BigInt** — persistir `erpId` como `BigInt`; serializar para `number` só na API com check de safe integer (mesmo helper atual).
