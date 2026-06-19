# Módulo de Messaging — visão geral

Documento de referência para entender o que foi implementado, como os fluxos se conectam e o que extrair ao modularizar a **recepção de mensagens** (webhook/sync FLW) em um módulo à parte.

**Código:** `src/modules/messaging/`  
**Registro:** `AppModule` importa `MessagingModule`  
**KPIs relacionados:** `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts` + flag `WHATSAPP_KPI_SOURCE`

---

## Objetivo

Unificar mensageria WhatsApp em um modelo **canônico** independente do provedor:

| Provedor | Origem dos dados | `provider` |
| --- | --- | --- |
| **FLW** (operacional) | API WTS Chat + webhooks | `FLW` |
| **DKW** (legado) | `core.sessions` / `core.messages` | `DKW` |

O legado DKW **não é alterado** — só lido para migração e enriquecimento de contatos/tags.

---

## Arquitetura em 3 camadas

```text
                    ┌─────────────────────────────────────────┐
  FLW API / Webhook │  raw.flw_sessions / raw.flw_messages    │  snapshot JSON
                    └──────────────────┬──────────────────────┘
                                       │ MessagingNormalizationService
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  core.messaging_sessions                │
                    │  core.messaging_messages                │
                    │  core.messaging_contacts (+ contact_id) │
                    └──────────────────┬──────────────────────┘
                                       │
         DKW migrator ─────────────────┤ (upsert direto no canônico)
                                       ▼
                    ┌─────────────────────────────────────────┐
  KPIs WhatsApp     │  WHATSAPP_KPI_SOURCE=legacy|canonical   │
                    └─────────────────────────────────────────┘
```

**Padrão de ingestão FLW:** sempre **raw primeiro**, depois normalização para canônico.  
**Padrão DKW:** lê legado e grava direto no canônico (sem raw).

---

## Tabelas e migrations

| Migration | Conteúdo |
| --- | --- |
| `20260615_add_raw_flw_messaging_tables.sql` | `raw.flw_sessions`, `raw.flw_messages` |
| `20260615_add_core_messaging_canonical_tables.sql` | `core.messaging_sessions`, `core.messaging_messages`, enums |
| `20260615_add_messaging_sync_state.sql` | `core.messaging_sync_states` |
| `20260615_add_branch_flw_department_id.sql` | `core.branches.flw_department_id` → branch canônica FLW |
| `20260617_add_messaging_contacts.sql` | `core.messaging_contacts`, `messaging_sessions.contact_id` |

### `core.messaging_sessions`

- PK: `id` = `{clientId}:{provider}:{externalSessionId}`
- `contact_external_id` — id do provedor (uuid FLW ou id/telefone DKW)
- `contact_id` — FK para `messaging_contacts.id`
- `branch_id` — mapeado de `departmentId` FLW via `branches.flw_department_id`
- `assigned_agent_email` — KPIs filtram por `chatId` (= email)

### `core.messaging_messages`

- PK: `id` = `{clientId}:{provider}:{externalMessageId}`
- `direction`: `INBOUND` | `OUTBOUND`
- `sender_type`: `HUMAN` | `SYSTEM` | `AI` | `BOT`
- `created_at_external` — timestamp da mensagem no provedor

### `core.messaging_contacts`

- PK: `id` = `{clientId}:{provider}:{externalContactId}`
- `legacy_contact_id` — ponte para `core.contacts` (DKW, match id/telefone) → KPIs por tag
- FK composta: `(client_id, legacy_contact_id) → core.contacts(client_id, id)`

### Raw FLW

- Guarda `payload_json` completo + `source` (`api_sync` | `webhook`)
- Normalização relê **todo** o raw do client e re-upserta canônico (idempotente)

---

## IDs canônicos

```text
Session:  {clientId}:FLW:{sessionUuid}   | {clientId}:DKW:{externalSessionId}
Message:  {clientId}:FLW:{messageUuid}   | {clientId}:DKW:{externalMessageId}
Contact:  {clientId}:FLW:{contactUuid}   | {clientId}:DKW:{externalContactId}
```

Helpers em:

- `flw-message-mapper.ts` — FLW
- `dkw-legacy-message-mapper.ts` — DKW
- `messaging-contact-types.ts` — contatos

---

## Fluxos principais

### 1. Receber mensagem via webhook FLW (tempo real)

**Rota:** `POST /webhooks/flw/:clientId`  
**Controller:** `FlwWebhookController`  
**Service:** `FlwWebhookIngestService`

```text
Payload JSON
  → resolveFlwWebhookEventType / extract session|message
  → PrismaFlwRawRepository.upsertSession|upsertMessage  (source=webhook)
  → MessagingNormalizationService.normalizeClient(clientId)
       → mapFlwSessionToCanonical / mapFlwMessageToCanonical
       → MessagingContactService.upsertSessionWithContact
       → PrismaMessagingCanonicalRepository.upsertMessage
```

**Eventos suportados:** `SESSION_NEW`, `SESSION_UPDATE`, `SESSION_COMPLETE`, `MESSAGE_RECEIVED`, `MESSAGE_SENT`, `MESSAGE_UPDATED`

**Auth:** header `X-FLW-Webhook-Secret` vs `FLW_WEBHOOK_SECRET` (se configurado)

**Logs:** prefixo `[flw-webhook]`

---

### 2. Sync paginado FLW (API)

**Rota:** `POST /internal/messaging/sync?clientId=...`  
**Service:** `FlwMessagingSyncService`

```text
FlwChatApiClient.listSessions (createdAtAfter = lastSessionSyncAt)
  → raw.flw_* (source=api_sync)
  → por session: listMessages paginado
  → MessagingNormalizationService.normalizeClient
  → atualiza core.messaging_sync_states
```

**Env:** `FLW_CHAT_API_TOKEN`, `FLW_CHAT_API_BASE_URL`  
**Auth interna:** header `X-Job-Key` = `INTERNAL_JOB_KEY`

---

### 3. Migrador DKW (histórico)

**Rota:** `POST /internal/messaging/migrate-dkw?clientId&from&to` → **202** + job async  
**Status:** `GET /internal/messaging/migrate-dkw/:jobId`

**Services:** `DkwMessagingMigrationJobService` → `DkwMessagingMigrationService`

```text
Janelas mensais (splitPeriodIntoMonthlyWindows)
  → PrismaDkwLegacyRepository: sessions por started_at, messages por created_at_external
  → mapDkwSessionToCanonical / mapDkwMessageToCanonical
  → MessagingContactService.upsertSessionWithContact
  → upsertMessage
```

**Filtros legado:**

- Sessions: `core.sessions.started_at` na janela
- Messages: `core.messages.created_at_external`, exige `session_id IS NOT NULL`
- `contact_external_id` da session vem do ticket DKW (id ou telefone)

**Logs:** prefixo `[dkw-migrate]`

---

### 4. Contatos canônicos

**Criação automática:** todo `upsertSessionWithContact` (FLW normalização + migrador DKW)

**Backfill histórico:**  
`POST /internal/messaging/backfill-contacts?clientId=...[&from=...&to=...]` → **202**

```text
DISTINCT (provider, contact_external_id) de messaging_sessions
  [filtro opcional: started_at entre from e to]
  → upsert messaging_contacts
  → DKW: DkwContactEnricherService → legacy_contact_id via core.contacts
  → link contact_id em todas as sessions daquela chave
```

**Importante:** backfill **não** varre `core.contacts` inteiro — só contatos que aparecem em sessions.

---

### 5. Paridade legado vs canônico

**Rota:** `GET /internal/messaging/parity?clientId&from&to`  
**Service:** `MessagingParityCheckService` — compara contagens DKW legado vs canônico.

---

## Endpoints (resumo)

| Método | Rota | Auth | Função |
| --- | --- | --- | --- |
| `POST` | `/webhooks/flw/:clientId` | `X-FLW-Webhook-Secret` | Ingestão webhook FLW |
| `POST` | `/internal/messaging/sync` | `X-Job-Key` | Sync API FLW |
| `POST` | `/internal/messaging/migrate-dkw` | `X-Job-Key` | Job migrador DKW |
| `GET` | `/internal/messaging/migrate-dkw/:jobId` | `X-Job-Key` | Status migrador |
| `POST` | `/internal/messaging/backfill-contacts` | `X-Job-Key` | Job backfill contatos |
| `GET` | `/internal/messaging/backfill-contacts/:jobId` | `X-Job-Key` | Status backfill |
| `GET` | `/internal/messaging/parity` | `X-Job-Key` | Checagem paridade |

---

## Mapa de arquivos por responsabilidade

### Presentation

| Arquivo | Papel |
| --- | --- |
| `flw-webhook.controller.ts` | Entrada HTTP webhook |
| `internal-messaging-sync.controller.ts` | Jobs internos (sync, migrate, backfill, parity) |
| `query/*.query.ts` | Parse/validação de query params |

### Application — recepção FLW (candidatos a módulo separado)

| Arquivo | Papel |
| --- | --- |
| `flw-webhook-ingest.service.ts` | Orquestra webhook → raw → normalize |
| `flw-webhook-payload.ts` | Parse evento/session/message do JSON |
| `flw-webhook.logger.ts` | Logs estruturados |
| `flw-messaging-sync.service.ts` | Sync paginado API |
| `flw-message-mapper.ts` | FLW DTO → payload canônico |
| `messaging-normalization.service.ts` | Raw → canônico (compartilhado) |

### Application — DKW / contatos / jobs

| Arquivo | Papel |
| --- | --- |
| `dkw-messaging-migration.service.ts` | Migrador legado → canônico |
| `dkw-messaging-migration-job.service.ts` | Job async migrador |
| `dkw-legacy-message-mapper.ts` | DKW snapshot → canônico |
| `messaging-contact.service.ts` | Upsert contato + session |
| `dkw-contact-enricher.service.ts` | Match DKW → `core.contacts` |
| `messaging-contacts-backfill.service.ts` | Backfill contatos |
| `messaging-contacts-backfill-job.service.ts` | Job async backfill |
| `messaging-parity-check.service.ts` | Paridade KPI/migração |
| `phone-normalization.ts` | Normalização telefone E.164 |
| `messaging-contact-mapper.ts` | Session → contact payload |

### Infrastructure

| Arquivo | Papel |
| --- | --- |
| `flw-chat-api.client.ts` | Client HTTP API WTS Chat |
| `prisma-flw-raw.repository.ts` | Persistência raw FLW |
| `prisma-messaging-canonical.repository.ts` | Sessions, messages, sync state |
| `prisma-messaging-contact.repository.ts` | Contatos + link sessions |
| `prisma-dkw-legacy.repository.ts` | Leitura legado DKW |

### Domain

| Arquivo | Papel |
| --- | --- |
| `messaging-types.ts` | DTOs FLW/DKW + write payloads |
| `messaging-contact-types.ts` | Tipos contato + builder de id |

---

## Integração com KPIs

**Flag:** `WHATSAPP_KPI_SOURCE` = `legacy` | `canonical` | `dual`

| Métrica | Legado | Canônico |
| --- | --- | --- |
| Conversas / mensagens | `core.sessions` + `core.messages` | `messaging_sessions` + `messaging_messages` |
| Agente (`chatId`) | `assigned_user_email` | `assigned_agent_email` |
| Filial (`branchId`) | join employee por email | `messaging_sessions.branch_id` |
| **Tag hourly / comparação** | `sessions → tickets → contact_tags` | `messaging_sessions → messaging_contacts.legacy_contact_id → contact_tags` |

Arquivo: `prisma-whatsapp-kpi.repository.ts` + `whatsapp-kpi-source.ts`

---

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `FLW_CHAT_API_TOKEN` | Sync API FLW |
| `FLW_CHAT_API_BASE_URL` | Base URL chat (default WTS) |
| `FLW_WEBHOOK_SECRET` | Validação webhook (vazio = desabilitado) |
| `FLW_WEBHOOK_DEBUG` | Logs extras webhook |
| `INTERNAL_JOB_KEY` | Endpoints `/internal/messaging/*` |
| `WHATSAPP_KPI_SOURCE` | Origem queries KPI |

---

## Rollout operacional (ordem)

1. Aplicar migrations SQL (`prisma db execute --file ...`)
2. `npm run prisma:generate` + deploy
3. `POST /internal/messaging/migrate-dkw` — histórico DKW (janelas mensais)
4. `POST /internal/messaging/sync` — FLW (se necessário)
5. `POST /internal/messaging/backfill-contacts` — contatos + `contact_id` (janelas opcionais)
6. `GET /internal/messaging/parity` — validar
7. `WHATSAPP_KPI_SOURCE=canonical` (ou `dual` temporário)
8. Webhook FLW apontando para `POST /webhooks/flw/:clientId`

---

## Sugestão de modularização: “recepção de mensagens”

Ao extrair um módulo separado (ex.: `FlwIngestModule` ou `MessagingIngestModule`), este bloco fica **coeso**:

### Extrair (entrada + raw FLW)

- `FlwWebhookController`
- `FlwWebhookIngestService`
- `flw-webhook-payload.ts`, `flw-webhook.logger.ts`
- `FlwMessagingSyncService`
- `FlwChatApiClient`
- `PrismaFlwRawRepository`

### Manter compartilhado (contrato entre módulos)

- `MessagingNormalizationService` — ou mover para `MessagingCanonicalModule` e **exportar**
- `MessagingContactService` + repositórios canônicos
- Tipos em `domain/messaging-types.ts`

### Dependência sugerida

```text
FlwIngestModule
  imports: [MessagingCanonicalModule]   // normalization + upsert
  exports: [FlwMessagingSyncService]    // se outros módulos precisarem

MessagingCanonicalModule
  exports: [MessagingNormalizationService, MessagingContactService, ...]

MessagingMigrationModule (opcional)
  DKW migrator + backfill + parity
```

### Interface mínima entre módulos

```typescript
// Após gravar raw, o ingest chama:
normalizationService.normalizeClient(clientId): { sessionsWritten, messagesWritten }
```

O webhook **não** grava canônico diretamente — sempre passa pelo raw + normalização (reprocessável e idempotente).

---

## Specs e planos relacionados

- `docs/superpowers/plans/2026-06-15-flw-messaging-canonical-import.md`
- `docs/superpowers/specs/2026-06-15-messaging-canonical-contacts-design.md`
- `docs/superpowers/plans/2026-06-15-messaging-canonical-contacts.md`
- `docs/api/rest-api.md` — seção `/internal/messaging/*`

---

## Fora do escopo atual (fase 2)

- Importar todos os `core.contacts` sem session
- Match FLW → `legacy_contact_id` por telefone
- Sync de tags FLW
- Unificar DKW + FLW num único registro de contato
