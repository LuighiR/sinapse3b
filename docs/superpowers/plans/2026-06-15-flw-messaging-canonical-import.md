# FLW Messaging Canonical Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar mensagens e conversas do FLW Chat (`api.wts.chat`) sem apagar o legado DKW, normalizando tudo em tabelas canônicas provider-agnostic e migrando KPIs de WhatsApp para ler desse modelo unificado.

**Architecture:** Seguir o padrão de chamadas: ingestão bruta em `raw.flw_*`, normalização para `core.messaging_sessions` e `core.messaging_messages`, migrador idempotente do legado DKW (`core.sessions`/`core.messages`) para o canônico com `provider='DKW'`, e transição gradual dos KPIs de `core.messages` para o canônico via feature flag ou repositório dual-read.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma 7, PostgreSQL, Jest, OpenAPI specs em `endpoints/` (referência `IA-GUIA.md`)

**Branch:** `flw-messaging-canonical-import`

**Worktree:** `.worktrees/flw-messaging-canonical-import`

---

## Contexto e invariantes

- O legado DKW continua em `core.tickets`, `core.sessions`, `core.messages` e `imported_trackings`. **Nunca deletar** essas linhas neste projeto.
- O FLW usa UUIDs, `direction` (`FROM_HUB`/`TO_HUB`), `origin` (`BOT`, `API`, `DEFAULT`, etc.) e sessions como conversa (`GET /v2/session`, `GET /v1/session/{id}/message`).
- KPIs atuais leem `core.messages` + `core.sessions` + `core.tickets` diretamente (`prisma-whatsapp-kpi.repository.ts`).
- Filtro `chatId` hoje usa `sessions.assigned_user_email`; no FLW mapear de `agentDetails.email` / `userId`.
- Filtro `branchId` hoje deriva de `employees.chat_id`; no FLW precisa de `branches.flw_department_id` (ou tabela de mapeamento).

## Mapeamento de campos (referência)

| Canônico | FLW (`PublicMessageDTO` / `PublicSessionDTOV2`) | DKW legado |
| --- | --- | --- |
| `provider` | `'FLW'` | `'DKW'` |
| `external_message_id` | `message.id` (uuid) | `messages.external_message_id` |
| `external_session_id` | `session.id` (uuid) | `sessions.external_tracking_id` ou `sessions.id` |
| `direction` | `TO_HUB` → `INBOUND`, `FROM_HUB` → `OUTBOUND` | `from_me=false` → `INBOUND` |
| `sender_type` | `origin=BOT` → `BOT`; `origin=API` → `SYSTEM`; com `userId` → `HUMAN`; default cliente → `HUMAN` | `messages.sender_type` |
| `message_type` | `message.type` (`TEXT`, `IMAGE`, ...) | inferir de `media_type` ou `'TEXT'` |
| `body_text` | `message.text ?? ''` | `messages.body` |
| `media_url` | `details.file.publicUrl` | `messages.media_url` |
| `assigned_agent_email` | `agentDetails.email` | `sessions.assigned_user_email` |
| `started_at` | `session.startAt` | `sessions.started_at` |
| `ended_at` | `session.endAt` | `sessions.ended_at` |

## Arquivos previstos

### Schema e migrations

- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.spec.ts`
- Create: `prisma/migrations/20260615_add_raw_flw_messaging_tables.sql`
- Create: `prisma/migrations/20260615_add_core_messaging_canonical_tables.sql`
- Create: `prisma/migrations/20260615_add_branch_flw_department_id.sql`
- Create: `prisma/migrations/20260615_add_messaging_sync_state.sql`

### Módulo de importação / normalização

- Create: `src/modules/messaging/messaging.module.ts`
- Create: `src/modules/messaging/domain/messaging-provider.ts`
- Create: `src/modules/messaging/domain/messaging-types.ts`
- Create: `src/modules/messaging/infrastructure/flw-chat-api.client.ts`
- Create: `src/modules/messaging/infrastructure/flw-chat-api.client.spec.ts`
- Create: `src/modules/messaging/infrastructure/prisma-flw-raw.repository.ts`
- Create: `src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts`
- Create: `src/modules/messaging/application/flw-message-mapper.ts`
- Create: `src/modules/messaging/application/flw-message-mapper.spec.ts`
- Create: `src/modules/messaging/application/dkw-legacy-message-mapper.ts`
- Create: `src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts`
- Create: `src/modules/messaging/application/flw-messaging-sync.service.ts`
- Create: `src/modules/messaging/application/flw-messaging-sync.service.spec.ts`
- Create: `src/modules/messaging/application/dkw-messaging-migration.service.ts`
- Create: `src/modules/messaging/application/dkw-messaging-migration.service.spec.ts`
- Create: `src/modules/messaging/application/messaging-normalization.service.ts`
- Create: `src/modules/messaging/application/messaging-normalization.service.spec.ts`
- Create: `src/modules/messaging/presentation/internal-messaging-sync.controller.ts`
- Create: `src/modules/messaging/presentation/internal-messaging-sync.controller.spec.ts`
- Create: `src/modules/messaging/presentation/query/messaging-sync.query.ts`
- Modify: `src/config/env.ts`
- Modify: `src/config/env.spec.ts`
- Modify: `src/app.module.ts`

### KPIs (fase final)

- Modify: `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts`
- Modify: `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts`
- Modify: `docs/kpi-catalog.md`
- Modify: `docs/api/rest-api.md`

### Documentação de referência

- Track: `IA-GUIA.md` e `endpoints/` (hoje untracked no repo; decidir se entram nesta branch ou ficam só local)

---

## Task 0: Preparar branch e baseline

**Files:**
- Create: este plano em `docs/superpowers/plans/2026-06-15-flw-messaging-canonical-import.md`

- [ ] **Step 1: Criar worktree isolada**

```powershell
git worktree add .worktrees/flw-messaging-canonical-import -b flw-messaging-canonical-import
```

Expected: branch `flw-messaging-canonical-import` criada a partir de `main`.

- [ ] **Step 2: Instalar dependências na worktree**

```powershell
cd .worktrees/flw-messaging-canonical-import
npm install
```

- [ ] **Step 3: Rodar baseline de testes**

```powershell
$env:INTERNAL_JOB_KEY='test-internal-job-key'
npm test
```

Expected: suite atual passando (mesmo baseline de `main`).

- [ ] **Step 4: Commit inicial do plano**

```powershell
git add docs/superpowers/plans/2026-06-15-flw-messaging-canonical-import.md
git commit -m "docs: add FLW messaging canonical import plan"
```

---

## Task 1: Schema raw FLW + estado de sync

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.spec.ts`
- Create: `prisma/migrations/20260615_add_raw_flw_messaging_tables.sql`
- Create: `prisma/migrations/20260615_add_messaging_sync_state.sql`

- [ ] **Step 1: Escrever teste falhando do schema**

Em `prisma/schema.spec.ts`:

```typescript
it('maps raw FLW messaging tables and sync state', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8')

  expect(schema).toContain('model FlwSessionRaw')
  expect(schema).toContain('model FlwMessageRaw')
  expect(schema).toContain('model MessagingSyncState')
  expect(schema).toContain('@@schema("raw")')
})
```

- [ ] **Step 2: Rodar teste e confirmar FAIL**

Run: `npm test -- prisma/schema.spec.ts`
Expected: FAIL — modelos ainda não existem.

- [ ] **Step 3: Criar migration SQL raw**

```sql
CREATE TABLE IF NOT EXISTS raw.flw_sessions (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  payload_json jsonb NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flw_sessions_client_fetched_at_idx
  ON raw.flw_sessions (client_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS raw.flw_messages (
  id uuid PRIMARY KEY,
  client_id text NOT NULL,
  session_id uuid NOT NULL,
  payload_json jsonb NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flw_messages_client_session_fetched_at_idx
  ON raw.flw_messages (client_id, session_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS core.messaging_sync_states (
  client_id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'FLW',
  last_session_sync_at timestamptz NULL,
  last_message_sync_at timestamptz NULL,
  last_success_at timestamptz NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Adicionar modelos Prisma**

Mapear `FlwSessionRaw`, `FlwMessageRaw` em `@@schema("raw")` e `MessagingSyncState` em `@@schema("core")` com `createdAt`/`updatedAt` onde fizer sentido operacional.

- [ ] **Step 5: Gerar client e rodar teste**

Run:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/sinapse'
npm run prisma:generate
npm test -- prisma/schema.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema.prisma prisma/schema.spec.ts prisma/migrations/20260615_add_raw_flw_messaging_tables.sql prisma/migrations/20260615_add_messaging_sync_state.sql
git commit -m "feat(messaging): add raw FLW tables and sync state"
```

---

## Task 2: Schema canônico + mapeamento de filial

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.spec.ts`
- Create: `prisma/migrations/20260615_add_core_messaging_canonical_tables.sql`
- Create: `prisma/migrations/20260615_add_branch_flw_department_id.sql`

- [ ] **Step 1: Escrever teste falhando**

```typescript
it('maps canonical messaging tables and branch FLW department id', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8')

  expect(schema).toContain('model MessagingSession')
  expect(schema).toContain('model MessagingMessage')
  expect(schema).toContain('flwDepartmentId')
  expect(schema).toContain('enum MessagingProvider')
})
```

- [ ] **Step 2: Confirmar FAIL**

Run: `npm test -- prisma/schema.spec.ts`

- [ ] **Step 3: Migration canônica**

```sql
CREATE TYPE core.messaging_provider AS ENUM ('FLW', 'DKW');

CREATE TYPE core.messaging_direction AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TYPE core.messaging_sender_type AS ENUM ('HUMAN', 'SYSTEM', 'AI', 'BOT');

CREATE TABLE IF NOT EXISTS core.messaging_sessions (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  branch_id integer NULL,
  provider core.messaging_provider NOT NULL,
  external_session_id text NOT NULL,
  contact_external_id text NULL,
  assigned_agent_email text NULL,
  assigned_agent_user_id text NULL,
  status text NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  raw_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT messaging_sessions_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES core.branches(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_sessions_client_provider_external_key
  ON core.messaging_sessions (client_id, provider, external_session_id);

CREATE INDEX IF NOT EXISTS messaging_sessions_client_started_at_idx
  ON core.messaging_sessions (client_id, started_at);

CREATE INDEX IF NOT EXISTS messaging_sessions_client_branch_started_at_idx
  ON core.messaging_sessions (client_id, branch_id, started_at);

CREATE TABLE IF NOT EXISTS core.messaging_messages (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  session_id text NOT NULL,
  provider core.messaging_provider NOT NULL,
  external_message_id text NOT NULL,
  direction core.messaging_direction NOT NULL,
  sender_type core.messaging_sender_type NOT NULL,
  message_type text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  media_url text NULL,
  media_type text NULL,
  created_at_external timestamptz NOT NULL,
  updated_at_external timestamptz NOT NULL,
  raw_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT messaging_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES core.messaging_sessions(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_messages_client_provider_external_key
  ON core.messaging_messages (client_id, provider, external_message_id);

CREATE INDEX IF NOT EXISTS messaging_messages_session_created_at_external_idx
  ON core.messaging_messages (session_id, created_at_external);

CREATE INDEX IF NOT EXISTS messaging_messages_client_created_at_external_idx
  ON core.messaging_messages (client_id, created_at_external);

ALTER TABLE core.branches
  ADD COLUMN IF NOT EXISTS flw_department_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS branches_flw_department_id_key
  ON core.branches (flw_department_id)
  WHERE flw_department_id IS NOT NULL;
```

- [ ] **Step 4: Adicionar enums/modelos Prisma + relação `Branch.messagingSessions`**

- [ ] **Step 5: Rodar testes de schema**

Run: `npm run prisma:generate; npm test -- prisma/schema.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git commit -m "feat(messaging): add canonical messaging tables and branch department mapping"
```

---

## Task 3: Configuração e cliente HTTP FLW

**Files:**
- Create: `src/modules/messaging/infrastructure/flw-chat-api.client.ts`
- Create: `src/modules/messaging/infrastructure/flw-chat-api.client.spec.ts`
- Modify: `src/config/env.ts`
- Modify: `src/config/env.spec.ts`

- [ ] **Step 1: Adicionar env vars**

```typescript
FLW_CHAT_API_BASE_URL: z.string().default('https://api.wts.chat/chat').transform((v) => v.trim()),
FLW_CHAT_CORE_BASE_URL: z.string().default('https://api.wts.chat/core').transform((v) => v.trim()),
FLW_CHAT_API_TOKEN: z.string().default('').transform((v) => v.trim()),
```

Token por tenant pode ficar para fase 2 em `core.sinapse_clients` ou tabela de integração; na v1 usar env global + override futuro.

- [ ] **Step 2: Escrever teste falhando do client**

Cobrir:
- monta header `Authorization: Bearer ...`
- pagina `GET /v2/session` respeitando `PageNumber`/`PageSize`
- pagina `GET /v1/session/{id}/message`
- propaga erro HTTP da API

- [ ] **Step 3: Implementar client mínimo**

Tipos baseados nos OpenAPI em:
- `endpoints/get_v2-session.openapi.yaml`
- `endpoints/get_v1-session-id-message.openapi.yaml`
- `endpoints/get_v2-session-id.openapi.yaml`

- [ ] **Step 4: Rodar testes**

Run: `npm test -- src/modules/messaging/infrastructure/flw-chat-api.client.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat(messaging): add FLW Chat API client"
```

---

## Task 4: Mapper FLW → canônico

**Files:**
- Create: `src/modules/messaging/application/flw-message-mapper.ts`
- Create: `src/modules/messaging/application/flw-message-mapper.spec.ts`
- Create: `src/modules/messaging/domain/messaging-types.ts`

- [ ] **Step 1: Escrever testes falhando**

Casos obrigatórios:
- `direction=TO_HUB` → `INBOUND`
- `direction=FROM_HUB` → `OUTBOUND`
- `origin=BOT` → `sender_type=BOT`
- `origin=API` → `sender_type=SYSTEM`
- mensagem de atendente com `userId` → `sender_type=HUMAN`
- `details.file.publicUrl` vira `media_url`
- session usa `agentDetails.email` em `assigned_agent_email`
- `departmentId` resolve `branch_id` via lookup

- [ ] **Step 2: Implementar mapper puro (sem I/O)**

Funções sugeridas:
- `mapFlwSessionToCanonical(...)`
- `mapFlwMessageToCanonical(...)`
- `resolveSenderType(message)`
- `resolveDirection(message)`

- [ ] **Step 3: Rodar testes**

Run: `npm test -- src/modules/messaging/application/flw-message-mapper.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat(messaging): map FLW payloads to canonical messaging model"
```

---

## Task 5: Importador FLW (sync paginado estilo DKW)

**Files:**
- Create: `src/modules/messaging/infrastructure/prisma-flw-raw.repository.ts`
- Create: `src/modules/messaging/infrastructure/prisma-messaging-canonical.repository.ts`
- Create: `src/modules/messaging/application/flw-messaging-sync.service.ts`
- Create: `src/modules/messaging/application/flw-messaging-sync.service.spec.ts`
- Create: `src/modules/messaging/application/messaging-normalization.service.ts`
- Create: `src/modules/messaging/application/messaging-normalization.service.spec.ts`
- Create: `src/modules/messaging/messaging.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Escrever testes falhando do sync service**

Cobrir:
- primeira execução pagina sessions e messages
- grava raw (`source='api_sync'`)
- normaliza para canônico com upsert idempotente
- atualiza `messaging_sync_states.last_*`
- reprocessar mesmo intervalo não duplica (`client_id + provider + external_*`)
- ignora sessions sem token/config inválida com erro persistido

- [ ] **Step 2: Implementar fluxo**

```text
1. ler cursor em messaging_sync_states
2. GET /v2/session?CreatedAt.After=<cursor>&PageNumber=N
3. upsert raw.flw_sessions
4. GET /v1/session/{id}/message paginado
5. upsert raw.flw_messages
6. normalizar raw -> core.messaging_*
7. atualizar cursor e last_success_at
```

- [ ] **Step 3: Implementar normalização**

Upsert SQL ou Prisma com chaves:
- sessions: `(client_id, provider, external_session_id)`
- messages: `(client_id, provider, external_message_id)`

IDs internos sugeridos:
- session: `${clientId}:FLW:${externalSessionId}`
- message: `${clientId}:FLW:${externalMessageId}`

- [ ] **Step 4: Expor endpoint interno de refresh**

`POST /internal/messaging/sync?clientId=...` protegido por `INTERNAL_JOB_KEY`, espelhando jobs de KPI.

- [ ] **Step 5: Rodar testes focados**

Run:

```powershell
npm test -- src/modules/messaging/application/flw-messaging-sync.service.spec.ts
npm test -- src/modules/messaging/application/messaging-normalization.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git commit -m "feat(messaging): add FLW paginated sync and canonical normalization"
```

---

## Task 6: Webhooks FLW (incremental)

**Files:**
- Create: `src/modules/messaging/presentation/flw-webhook.controller.ts`
- Create: `src/modules/messaging/presentation/flw-webhook.controller.spec.ts`
- Create: `src/modules/messaging/application/flw-webhook-ingest.service.ts`
- Create: `src/modules/messaging/application/flw-webhook-ingest.service.spec.ts`

- [ ] **Step 1: Definir eventos suportados na v1**

Prioridade:
- `SESSION_NEW`
- `SESSION_UPDATE`
- `SESSION_COMPLETE`
- `MESSAGE_RECEIVED`
- `MESSAGE_SENT`
- `MESSAGE_UPDATED`

Referência: `endpoints/get_v1-webhook-event.openapi.yaml`

- [ ] **Step 2: Escrever testes falhando**

Cobrir:
- payload válido grava raw com `source='webhook'`
- dispara normalização da session/message afetada
- evento desconhecido retorna 202/ignored sem quebrar pipeline
- assinatura/auth do webhook (header secret configurável)

- [ ] **Step 3: Implementar ingest incremental**

Reusar repositories da Task 5; não duplicar lógica de normalização.

- [ ] **Step 4: Documentar URL pública esperada**

Atualizar `docs/api/rest-api.md` com rota interna/pública do webhook.

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat(messaging): ingest FLW webhooks incrementally"
```

---

## Task 7: Migrador DKW legado → canônico

**Files:**
- Create: `src/modules/messaging/application/dkw-legacy-message-mapper.ts`
- Create: `src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts`
- Create: `src/modules/messaging/application/dkw-messaging-migration.service.ts`
- Create: `src/modules/messaging/application/dkw-messaging-migration.service.spec.ts`

- [ ] **Step 1: Escrever testes falhando**

Casos:
- session DKW vira `provider='DKW'`
- message DKW preserva timestamps e `sender_type`
- `assigned_user_email` legado mapeia para `assigned_agent_email`
- tickets/sessions/messages legados **não são alterados**
- upsert idempotente no canônico

- [ ] **Step 2: Implementar migrador batch**

Leitura:

```sql
FROM core.sessions s
JOIN core.tickets t ON t.id = s.ticket_id
JOIN core.messages m ON m.session_id = s.id
WHERE t.client_id = $1
```

Escrita: `core.messaging_sessions` / `core.messaging_messages` com `provider='DKW'`.

- [ ] **Step 3: Expor job interno**

`POST /internal/messaging/migrate-dkw?clientId=...`

- [ ] **Step 4: Rodar testes**

Run:

```powershell
npm test -- src/modules/messaging/application/dkw-legacy-message-mapper.spec.ts
npm test -- src/modules/messaging/application/dkw-messaging-migration.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat(messaging): migrate legacy DKW conversations into canonical tables"
```

---

## Task 8: Validação cruzada (legado vs canônico)

**Files:**
- Create: `src/modules/messaging/application/messaging-parity-check.service.ts`
- Create: `src/modules/messaging/application/messaging-parity-check.service.spec.ts`
- Create: `scripts/messaging-parity-check.ts` (opcional CLI)

- [ ] **Step 1: Escrever testes de paridade**

Comparar por `clientId` + intervalo:
- total sessions
- total inbound human messages
- ranking por agent email (top N)

- [ ] **Step 2: Implementar checker**

Retornar diff estruturado:

```typescript
{
  sessionsLegacy: number
  sessionsCanonical: number
  inboundMessagesLegacy: number
  inboundMessagesCanonical: number
  mismatches: Array<{ kind: string; details: string }>
}
```

- [ ] **Step 3: Endpoint interno de diagnóstico**

`GET /internal/messaging/parity?clientId=...&from=...&to=...`

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat(messaging): add parity checks between legacy and canonical data"
```

---

## Task 9: Switch dos KPIs WhatsApp

**Files:**
- Modify: `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts`
- Modify: `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts`
- Modify: `docs/kpi-catalog.md`
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Introduzir flag de leitura**

Env sugerida:

```typescript
WHATSAPP_KPI_SOURCE: z.enum(['legacy', 'canonical', 'dual']).default('legacy')
```

- [ ] **Step 2: Escrever testes falhando**

Cobrir queries em `canonical`:
- summary counts
- agents ranking
- messages hourly/daily (`direction=INBOUND`, `sender_type=HUMAN`)
- branch filter via `messaging_sessions.branch_id`
- chatId via `assigned_agent_email`

- [ ] **Step 3: Implementar SQL canônico**

Substituir joins:

```sql
FROM core.messaging_messages mm
JOIN core.messaging_sessions ms ON ms.id = mm.session_id
WHERE mm.client_id = $clientId
  AND mm.direction = 'INBOUND'
  AND mm.sender_type = 'HUMAN'
```

Modo `dual`: executar ambos e logar diff (somente internal/diag).

- [ ] **Step 4: Atualizar docs**

Documentar transição e novos campos operacionais (`flw_department_id`).

- [ ] **Step 5: Rodar testes KPI**

Run:

```powershell
npm test -- src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.spec.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git commit -m "feat(kpi): read WhatsApp metrics from canonical messaging tables"
```

---

## Task 10: Rollout operacional e deprecação suave

**Files:**
- Modify: `docs/kpi-catalog.md`
- Modify: `docs/api/rest-api.md`

- [ ] **Step 1: Documentar rollout**

Ordem em produção:

1. aplicar migrations
2. popular `core.branches.flw_department_id`
3. configurar `FLW_CHAT_API_TOKEN`
4. rodar `POST /internal/messaging/sync`
5. rodar `POST /internal/messaging/migrate-dkw`
6. validar paridade em janela piloto
7. setar `WHATSAPP_KPI_SOURCE=canonical`

- [ ] **Step 2: SQL de backfill operacional**

```sql
-- exemplo: mapear department FLW -> filial
UPDATE core.branches
SET flw_department_id = '00000000-0000-0000-0000-000000000001'::uuid,
    updated_at = NOW()
WHERE id = 2;
```

- [ ] **Step 3: Documentar o que NÃO fazer**

- não truncar `core.messages`
- não remover `imported_trackings`
- não trocar KPIs antes da paridade aceitável

- [ ] **Step 4: Commit final de docs**

```powershell
git commit -m "docs: add FLW messaging rollout and KPI source migration notes"
```

---

## Verificação final da branch

Run:

```powershell
$env:INTERNAL_JOB_KEY='test-internal-job-key'
npm test
npm run build
```

Expected: testes e build passando.

Checklist de aceite:

- [ ] FLW sync importa sessions/messages para raw + canônico
- [ ] Migrador DKW preenche canônico sem tocar legado
- [ ] Paridade documentada e endpoint de diagnóstico disponível
- [ ] KPIs conseguem ler do canônico via flag
- [ ] Nenhuma tabela legada foi removida

---

## Handoff de execução

Plano salvo em `docs/superpowers/plans/2026-06-15-flw-messaging-canonical-import.md`.

**Opções de execução:**

1. **Subagent-Driven (recomendado)** — uma task por subagent, com review entre tasks (`@superpowers:subagent-driven-development`)
2. **Inline Execution** — executar task a task nesta sessão (`@superpowers:executing-plans`)

Qual abordagem você prefere?
