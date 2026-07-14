# WhatsApp City Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classificar sessões WhatsApp FLW por cidade operacional (independente de filiais), com tabelas editáveis, desnormalização na sessão, CRUD REST e filtro `whatsappCityId` nos KPIs.

**Architecture:** Cadastro `whatsapp_cities` + mapa `whatsapp_department_mappings` (`departmentId` FLW → cidade). Na normalização, gravar `external_department_id` e `whatsapp_city_id` em `messaging_sessions`; filas desconhecidas viram mapeamento `PENDING`. Edição do mapa atualiza só as sessões daquela fila. Seed Ferracosul + backfill histórico. KPIs canônicos filtram por `whatsapp_city_id`.

**Tech Stack:** NestJS, Prisma, PostgreSQL (SQL migrations manuais), Zod, Jest

**Spec:** `docs/superpowers/specs/2026-07-14-whatsapp-city-classification-design.md`

---

## Arquivos previstos

### Schema / migration

- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.spec.ts`
- Create: `prisma/migrations/20260714_add_whatsapp_city_classification.sql`

### Messaging (normalização)

- Modify: `src/modules/messaging/domain/messaging-types.ts`
- Modify: `src/modules/messaging/application/flw-message-mapper.ts`
- Modify: `src/modules/messaging/application/flw-message-mapper.spec.ts`
- Modify: `src/modules/messaging/application/dkw-legacy-message-mapper.ts` (preencher `whatsappCityId`/`externalDepartmentId` = `null`)
- Modify: `src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts` (se monta payload)
- Modify: `src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts` (incl. `findSampleSessionByContactKey` mapping)
- Modify: `src/modules/messaging/application/messaging-normalization.service.ts`
- Modify: `src/modules/messaging/application/messaging-normalization.service.spec.ts`

### CRUD módulo novo

- Create: `src/modules/whatsapp-cities/whatsapp-cities.module.ts`
- Create: `src/modules/whatsapp-cities/application/whatsapp-cities.service.ts`
- Create: `src/modules/whatsapp-cities/application/whatsapp-cities.service.spec.ts`
- Create: `src/modules/whatsapp-cities/application/whatsapp-department-mappings.service.ts`
- Create: `src/modules/whatsapp-cities/application/whatsapp-department-mappings.service.spec.ts`
- Create: `src/modules/whatsapp-cities/presentation/whatsapp-cities.controller.ts`
- Create: `src/modules/whatsapp-cities/presentation/whatsapp-department-mappings.controller.ts`
- Create: `src/modules/whatsapp-cities/presentation/body/*.ts` (create/update parsers Zod)
- Modify: `src/app.module.ts`

### Seed / backfill

- Create: `src/scripts/seed-ferracosul-whatsapp-cities.ts`
- Create: `src/scripts/seed-ferracosul-whatsapp-cities.spec.ts`
- Create: `scripts/seed-ferracosul-whatsapp-cities.ts` (wrapper CLI)
- Modify: `package.json` (script npm)

### KPIs

- Modify: `src/modules/kpi/presentation/query/whatsapp-summary.query.ts`
- Modify: `src/modules/kpi/presentation/query/whatsapp-summary.query.spec.ts`
- Modify: `src/modules/kpi/application/whatsapp-kpi-query.service.ts`
- Modify: `src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts`
- Modify: `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts`

### Docs

- Modify: `docs/messaging-module-overview.md` (breve menção aos novos campos/tabelas)
- Modify: `docs/api/rest-api.md` se já documentar rotas tenant-scoped semelhantes

---

### Task 1: Schema Prisma + migration SQL

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.spec.ts`
- Create: `prisma/migrations/20260714_add_whatsapp_city_classification.sql`

- [ ] **Step 1: Escrever testes de schema que falham**

Em `prisma/schema.spec.ts`, adicionar expects:

```typescript
expect(schema).toContain('enum WhatsAppDepartmentMappingStatus')
expect(schema).toContain('model WhatsAppCity')
expect(schema).toContain('model WhatsAppDepartmentMapping')
expect(schema).toContain('whatsappCityId')
expect(schema).toContain('externalDepartmentId')
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `npm test -- prisma/schema.spec.ts`
Expected: FAIL (strings ausentes)

- [ ] **Step 3: Atualizar `schema.prisma`**

Adicionar enum e models em `@@schema("core")`:

```prisma
enum WhatsAppDepartmentMappingStatus {
  PENDING
  MAPPED

  @@map("whatsapp_department_mapping_status")
  @@schema("core")
}

model WhatsAppCity {
  id        String   @id @db.Uuid
  clientId  String   @map("client_id")
  name      String
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
  client    SinapseClient @relation(fields: [clientId], references: [id])
  mappings  WhatsAppDepartmentMapping[]
  sessions  MessagingSession[]

  @@unique([clientId, name], map: "whatsapp_cities_client_name_key")
  @@map("whatsapp_cities")
  @@schema("core")
}

model WhatsAppDepartmentMapping {
  id               String                           @id @db.Uuid
  clientId         String                           @map("client_id")
  departmentId     String                           @map("department_id") @db.Uuid
  departmentLabel  String?                          @map("department_label")
  cityId           String?                          @map("city_id") @db.Uuid
  status           WhatsAppDepartmentMappingStatus
  createdAt        DateTime                         @default(now()) @map("created_at")
  updatedAt        DateTime                         @default(now()) @updatedAt @map("updated_at")
  client           SinapseClient                    @relation(fields: [clientId], references: [id])
  city             WhatsAppCity?                    @relation(fields: [cityId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([clientId, departmentId], map: "whatsapp_department_mappings_client_department_key")
  @@index([clientId, status], map: "whatsapp_department_mappings_client_status_idx")
  @@map("whatsapp_department_mappings")
  @@schema("core")
}
```

Em `MessagingSession`, adicionar:

```prisma
whatsappCityId        String?       @map("whatsapp_city_id") @db.Uuid
externalDepartmentId  String?       @map("external_department_id") @db.Uuid
whatsappCity          WhatsAppCity? @relation(fields: [whatsappCityId], references: [id], onDelete: SetNull, onUpdate: Cascade)

@@index([clientId, whatsappCityId, startedAt], map: "messaging_sessions_client_whatsapp_city_started_at_idx")
@@index([clientId, externalDepartmentId], map: "messaging_sessions_client_external_department_idx")
```

Em `SinapseClient`, adicionar relações `whatsappCities` e `whatsappDepartmentMappings`.

- [ ] **Step 4: Criar SQL migration idempotente**

`prisma/migrations/20260714_add_whatsapp_city_classification.sql`:

- `CREATE TYPE core.whatsapp_department_mapping_status AS ENUM ('PENDING', 'MAPPED');` (padrão do repo: se tipo já existir, documentar no plan que o apply usa IF NOT EXISTS via DO block ou criar sem IF e aplicar uma vez)
- `CREATE TABLE IF NOT EXISTS core.whatsapp_cities (...)`
- `CREATE TABLE IF NOT EXISTS core.whatsapp_department_mappings (...)` com FK para cities e CHECK implícito via app (MAPPED+city)
- `ALTER TABLE core.messaging_sessions ADD COLUMN IF NOT EXISTS whatsapp_city_id uuid;`
- `ADD COLUMN IF NOT EXISTS external_department_id uuid;`
- FKs + índices unique/listados no schema

Para enum Postgres idempotente, seguir padrão:

```sql
DO $$ BEGIN
  CREATE TYPE core.whatsapp_department_mapping_status AS ENUM ('PENDING', 'MAPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 5: Rodar schema.spec + generate**

Run: `npm test -- prisma/schema.spec.ts`
Expected: PASS

Run: `npx prisma generate`
Expected: client regenerado

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/schema.spec.ts prisma/migrations/20260714_add_whatsapp_city_classification.sql
git commit -m "feat(db): add whatsapp cities and department mappings"
```

---

### Task 2: Mapper — `externalDepartmentId` + `whatsappCityId`

**Files:**
- Modify: `src/modules/messaging/domain/messaging-types.ts`
- Modify: `src/modules/messaging/application/flw-message-mapper.ts`
- Modify: `src/modules/messaging/application/flw-message-mapper.spec.ts`
- Modify: `src/modules/messaging/application/dkw-legacy-message-mapper.ts`
- Modify: `src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts`
- Modify: `src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts` (`findSampleSessionByContactKey` — Task 2 só tipagem/map; upsert dos campos novos fica na Task 3)

- [ ] **Step 1: Testes falhando no mapper**

Em `flw-message-mapper.spec.ts`:

```typescript
it('sets externalDepartmentId and whatsappCityId from department map', () => {
  const cityByDepartmentId = new Map([['dept-1', 'city-uuid']])
  const payload = mapFlwSessionToCanonical({
    clientId: 'c1',
    session: { /* ... */ departmentId: 'dept-1', /* ... */ },
    cityByDepartmentId,
  })
  expect(payload.externalDepartmentId).toBe('dept-1')
  expect(payload.whatsappCityId).toBe('city-uuid')
})

it('leaves whatsappCityId null when department unmapped', () => {
  const payload = mapFlwSessionToCanonical({
    clientId: 'c1',
    session: { /* ... */ departmentId: 'unknown', /* ... */ },
    cityByDepartmentId: new Map(),
  })
  expect(payload.externalDepartmentId).toBe('unknown')
  expect(payload.whatsappCityId).toBeNull()
})

it('leaves both null when departmentId absent', () => {
  const payload = mapFlwSessionToCanonical({
    clientId: 'c1',
    session: { /* ... sem departmentId ... */ },
    cityByDepartmentId: new Map([['x', 'y']]),
  })
  expect(payload.externalDepartmentId).toBeNull()
  expect(payload.whatsappCityId).toBeNull()
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- src/modules/messaging/application/flw-message-mapper.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Em `MessagingSessionWritePayload` adicionar:

```typescript
whatsappCityId: string | null
externalDepartmentId: string | null
```

Em `mapFlwSessionToCanonical`:

```typescript
branchIdByDepartmentId?: Map<string, number>
cityByDepartmentId?: Map<string, string> // departmentId → cityId (só MAPPED)
```

```typescript
const externalDepartmentId =
  typeof session.departmentId === 'string' ? session.departmentId : null
const whatsappCityId =
  externalDepartmentId != null && cityByDepartmentId != null
    ? cityByDepartmentId.get(externalDepartmentId) ?? null
    : null
```

Incluir no return object.

**Companheiros TypeScript (obrigatório na mesma task):**

- `mapDkwSessionToCanonical`: retornar `whatsappCityId: null`, `externalDepartmentId: null`
- Atualizar expects em `dkw-legacy-message-mapper.spec.ts`
- `findSampleSessionByContactKey` em `prisma-messaging-canonical.repository.ts`: mapear os novos campos do row (ou `null`)
- Qualquer fixture de teste que construa `MessagingSessionWritePayload` literalmente

- [ ] **Step 4: Rodar testes — PASS**

Run: `npm test -- src/modules/messaging/application/flw-message-mapper.spec.ts src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging/domain/messaging-types.ts src/modules/messaging/application/flw-message-mapper.ts src/modules/messaging/application/flw-message-mapper.spec.ts src/modules/messaging/application/dkw-legacy-message-mapper.ts src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts
git commit -m "feat(messaging): map FLW department to whatsapp city on session"
```

---

### Task 3: Repository — load city map, ensure PENDING, upsert session fields

**Files:**
- Modify: `src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts`
- Modify: `src/modules/messaging/application/messaging-normalization.service.ts`
- Modify: `src/modules/messaging/application/messaging-normalization.service.spec.ts`

- [ ] **Step 1: Testes de normalização falhando**

Estender `messaging-normalization.service.spec.ts`:

1. Mock `loadWhatsAppCityIdByDepartmentId` → Map com dept mapeado → payload/upsert recebe `whatsappCityId`
2. Mock: dept desconhecido → chama `resolveWhatsAppCityForDepartment` → cidade null
3. Sessão sem `departmentId` → não chama `resolveWhatsAppCityForDepartment`

- [ ] **Step 2: Rodar — FAIL**

Run: `npm test -- src/modules/messaging/application/messaging-normalization.service.spec.ts`

- [ ] **Step 3: Implementar no repository**

```typescript
async loadWhatsAppCityIdByDepartmentId(clientId: string): Promise<Map<string, string>> {
  const rows = await this.prisma.whatsAppDepartmentMapping.findMany({
    where: { clientId, status: 'MAPPED', cityId: { not: null } },
    select: { departmentId: true, cityId: true },
  })
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.cityId != null) map.set(row.departmentId, row.cityId)
  }
  return map
}

/** Idempotent under race: upsert PENDING if missing. Returns cityId if MAPPED else null. */
async resolveWhatsAppCityForDepartment(input: {
  clientId: string
  departmentId: string
}): Promise<string | null> {
  const existing = await this.prisma.whatsAppDepartmentMapping.findUnique({
    where: {
      clientId_departmentId: {
        clientId: input.clientId,
        departmentId: input.departmentId,
      },
    },
  })
  if (existing != null) {
    return existing.status === 'MAPPED' ? existing.cityId : null
  }
  try {
    await this.prisma.whatsAppDepartmentMapping.create({
      data: {
        id: randomUUID(),
        clientId: input.clientId,
        departmentId: input.departmentId,
        status: 'PENDING',
        cityId: null,
      },
    })
  } catch (error) {
    // P2002 unique → another worker created it; ignore
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error
    }
  }
  return null
}
```

Atualizar `upsertSession` create/update com `whatsappCityId` e `externalDepartmentId`.

- [ ] **Step 4: Wire no `MessagingNormalizationService`**

Opção preferida (eficiente):

1. `cityByDepartmentId = await loadWhatsAppCityIdByDepartmentId(clientId)` no início
2. Para cada sessão com `departmentId` **não** no map: `await resolveWhatsAppCityForDepartment(...)` (cria PENDING); não adiciona ao map (continua null)
3. Passar `cityByDepartmentId` ao mapper

Não recarregar o map inteiro a cada sessão.

- [ ] **Step 5: Testes PASS**

Run: `npm test -- src/modules/messaging/application/messaging-normalization.service.spec.ts src/modules/messaging/application/flw-message-mapper.spec.ts`

- [ ] **Step 6: Commit**

```bash
git add src/modules/messaging/
git commit -m "feat(messaging): resolve whatsapp city during FLW normalization"
```

---

### Task 4: CRUD `whatsapp-cities`

**Files:**
- Create module sob `src/modules/whatsapp-cities/`
- Modify: `src/app.module.ts`

Template: `src/modules/tenant-users/` (JwtAuthGuard + TenantScopeGuard + Zod body parsers).

- [ ] **Step 1: Testes do service (list/create/patch)**

`whatsapp-cities.service.spec.ts`:

- create com `authContext.clientId` + `randomUUID()`
- unique `(clientId, name)` → conflito tratado (ConflictException)
- patch `isActive` / `name`
- list respeita `activeOnly`

- [ ] **Step 2: FAIL → implementar service + controller + bodies + module**

Rotas:

- `GET /whatsapp-cities?activeOnly=true`
- `POST /whatsapp-cities` `{ name }`
- `PATCH /whatsapp-cities/:id` `{ name?, isActive? }`

Validar que `:id` pertence ao `clientId` do tenant (404 se não).

Registrar `WhatsAppCitiesModule` em `app.module.ts`.

- [ ] **Step 3: PASS + commit**

```bash
git add src/modules/whatsapp-cities/ src/app.module.ts
git commit -m "feat(api): CRUD whatsapp cities"
```

---

### Task 5: CRUD mapeamentos + update seletivo de sessões

**Files:**
- Create: `whatsapp-department-mappings.service.ts` (+ spec + controller + bodies)
- Reusar module da Task 4

- [ ] **Step 1: Testes do service cobrindo regras do spec**

Casos obrigatórios (espelhar spec PATCH/POST):

1. POST com `cityId` → `MAPPED` + `updateMany` sessões `externalDepartmentId` = dept
2. POST sem `cityId` → `PENDING`
3. POST upsert se dept já existe (PENDING → MAPPED)
4. PATCH omitindo `cityId` → **não** limpa cidade (só `departmentLabel` preserva mapeamento)
5. PATCH `cityId: null` → PENDING + zera `whatsapp_city_id` nas sessões
6. PATCH só `status: 'PENDING'` (sem `cityId`) → limpa `cityId` + PENDING + sync sessões
7. PATCH `status: 'MAPPED'` sem cidade resultante após merge → 400
8. PATCH `{ cityId, status: 'PENDING' }` → 400
9. `cityId` de outro client / inexistente → 400/404
10. Update seletivo: `prisma.messagingSession.updateMany({ where: { clientId, externalDepartmentId }, data: { whatsappCityId } })`

Helper interno:

```typescript
async syncSessionsCity(clientId: string, departmentId: string, cityId: string | null) {
  await this.prisma.messagingSession.updateMany({
    where: { clientId, externalDepartmentId: departmentId },
    data: { whatsappCityId: cityId },
  })
}
```

Chamar só quando `cityId`/`status` mudaram.

- [ ] **Step 2: FAIL → implementar**

Rotas:

- `GET /whatsapp-department-mappings?status=`
- `POST /whatsapp-department-mappings`
- `PATCH /whatsapp-department-mappings/:id`

- [ ] **Step 3: PASS + commit**

```bash
git add src/modules/whatsapp-cities/
git commit -m "feat(api): CRUD whatsapp department mappings with session sync"
```

---

### Task 6: Seed Ferracosul + backfill histórico

**Files:**
- Create: `src/scripts/seed-ferracosul-whatsapp-cities.ts`
- Create: `src/scripts/seed-ferracosul-whatsapp-cities.spec.ts`
- Create: `scripts/seed-ferracosul-whatsapp-cities.ts`
- Modify: `package.json`

`client_id` constante: `'ferracosul'` (igual `seed-ferracosul-admin.ts`).

- [ ] **Step 1: Teste unitário da lógica pura de seed (funções exportadas)**

Testar com Prisma mock ou funções puras:

- lista de 3 cidades + 17 mappings
- `buildBackfillSql` / ordem: upsert cities → upsert mappings → backfill `external_department_id` from raw → update city by mapping

- [ ] **Step 2: Implementar script**

Passos (spec):

1. Upsert 3 cities (`id = randomUUID()` na primeira criação; em re-run achar por `clientId+name`)
2. Upsert 17 mappings `MAPPED` on conflict `(client_id, department_id)`
3. Backfill:

```sql
UPDATE core.messaging_sessions
SET external_department_id = (raw_json->>'departmentId')::uuid
WHERE client_id = $clientId
  AND provider = 'FLW'
  AND external_department_id IS NULL
  AND raw_json ? 'departmentId'
  AND raw_json->>'departmentId' ~ '^[0-9a-f-]{36}$';
```

4. Para cada mapping MAPPED:

```sql
UPDATE core.messaging_sessions
SET whatsapp_city_id = $cityId
WHERE client_id = $clientId
  AND external_department_id = $departmentId;
```

UUIDs/labels: copiar da spec.

- [ ] **Step 3: npm script**

```json
"seed:whatsapp-cities": "ts-node scripts/seed-ferracosul-whatsapp-cities.ts"
```

- [ ] **Step 4: Testes PASS + commit**

```bash
git add src/scripts/seed-ferracosul-whatsapp-cities.ts src/scripts/seed-ferracosul-whatsapp-cities.spec.ts scripts/seed-ferracosul-whatsapp-cities.ts package.json
git commit -m "feat(seed): ferracosul whatsapp cities mappings and session backfill"
```

---

### Task 7: Filtro KPI `whatsappCityId`

**Files:**
- Modify: `whatsapp-summary.query.ts` (+ spec)
- Modify: `whatsapp-kpi-query.service.ts` (+ spec)
- Modify: `prisma-whatsapp-kpi.repository.ts`

- [ ] **Step 1: Teste do parser**

```typescript
expect(parseWhatsAppSummaryQuery({ from, to, whatsappCityId: 'ace13d85-5f0d-4bf6-b7fb-dad921af0c91' }).whatsappCityId)
  .toBe('ace13d85-5f0d-4bf6-b7fb-dad921af0c91')
```

UUID inválido → BadRequestException.

Usar `z.string().uuid()` (ou schema uuid já existente no projeto).

- [ ] **Step 2: FAIL → adicionar ao tipo/query**

```typescript
whatsappCityId?: string
```

- [ ] **Step 3: Service propaga `whatsappCityId` (não ignorar)**

Em todos os métodos que passam `branchId`/`chatId` ao repo, incluir `whatsappCityId`.

Teste: `expect(repo.getSummaryCounts).toHaveBeenCalledWith(expect.objectContaining({ whatsappCityId: '...' }))`

`branchId` continua ignorado via `resolveBranchScope`.

- [ ] **Step 4: Repository — filtro canônico**

```typescript
private buildCanonicalWhatsAppCityFilter(input: { whatsappCityId?: string }): Prisma.Sql {
  if (input.whatsappCityId === undefined) return Prisma.empty
  return Prisma.sql`and ms.whatsapp_city_id = ${input.whatsappCityId}::uuid`
}
```

Inserir `${this.buildCanonicalWhatsAppCityFilter(input)}` em **todas** as queries canônicas que já usam `buildCanonicalBranchFilter` sobre `messaging_sessions` / join `ms`.

Path legacy: **não** aplicar filtro city (coluna inexistente); se `whatsappCityId` definido e source=legacy, retornar vazio ou ignorar — preferir: só filtrar no canonical; em dual/legacy logar ou deixar sem filtro city documentado no código com comentário `// city filter only on canonical`.

Spec diz filtro nos KPIs da diretoria (canonical). Implementação mínima: aplicar só nos métodos `*Canonical*`.

- [ ] **Step 5: Testes PASS + commit**

```bash
git add src/modules/kpi/
git commit -m "feat(kpi): filter whatsapp metrics by whatsappCityId"
```

---

### Task 8: Docs + verificação final

**Files:**
- Modify: `docs/messaging-module-overview.md`
- Optionally: `docs/api/rest-api.md`

- [ ] **Step 1: Documentar tabelas/campos/rotas brevemente**

- [ ] **Step 2: Suite focada**

Run:

```bash
npm test -- prisma/schema.spec.ts src/modules/messaging/application/flw-message-mapper.spec.ts src/modules/messaging/application/messaging-normalization.service.spec.ts src/modules/whatsapp-cities src/modules/kpi/presentation/query/whatsapp-summary.query.spec.ts src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts src/scripts/seed-ferracosul-whatsapp-cities.spec.ts
```

Expected: PASS

- [ ] **Step 3: Commit docs**

```bash
git add docs/
git commit -m "docs: whatsapp city classification"
```

---

## Ordem de deploy operacional

1. Aplicar SQL: `npx prisma db execute --file prisma/migrations/20260714_add_whatsapp_city_classification.sql`
2. `npx prisma generate`
3. Deploy app
4. `npm run seed:whatsapp-cities`
5. Frontend passa a usar CRUD + `whatsappCityId` nos KPIs

**Nota KPI:** filtro `whatsappCityId` só tem efeito no path **canonical** (`WHATSAPP_KPI_SOURCE=canonical`). Em `legacy` a coluna não existe; em `dual` aplicar city só no braço canônico (legacy sem filtro city).

## Fora de escopo (não implementar)

- UI neste repo
- Remover `branch_id` / `flw_department_id`
- Filtro por tipo de fila nos KPIs
- Re-normalize `full` automático ao editar mapa
