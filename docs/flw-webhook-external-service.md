# Serviço externo — Webhook FLW (gravar raw)

Contrato para o **outro serviço** que vai receber webhooks FLW/WTS Chat e persistir em **`raw.flw_sessions`** / **`raw.flw_messages`**.

O Sinapse3 **não expõe mais** `POST /webhooks/flw/:clientId`. A normalização raw → core roda aqui via `POST /internal/messaging/normalize` (cron ~30 min).

---

## Responsabilidade do serviço externo

1. Expor HTTP `POST /webhooks/flw/:clientId` (ou rota equivalente)
2. Validar secret do FLW
3. Parsear evento/session/message
4. **Upsert idempotente** no Postgres (schema `raw`)
5. Responder **202** rápido — **sem** normalizar para `core.*`

---

## Banco de dados

### Migration necessária

Arquivo de referência no Sinapse3:

`prisma/migrations/20260615_add_raw_flw_messaging_tables.sql`

### `raw.flw_sessions`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | id da session no FLW |
| `client_id` | text | tenant (ex.: `ferracosul`) |
| `payload_json` | jsonb | snapshot normalizado (ver schema abaixo) |
| `source` | text | **`webhook`** |
| `fetched_at` | timestamptz | default `now()`; atualizar no upsert |

### `raw.flw_messages`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | id da mensagem no FLW |
| `client_id` | text | tenant |
| `session_id` | uuid | FK lógica para session |
| `payload_json` | jsonb | snapshot normalizado |
| `source` | text | **`webhook`** |
| `fetched_at` | timestamptz | default `now()`; atualizar no upsert |

**Upsert:** mesma PK → substituir `payload_json`, setar `source = 'webhook'`, `fetched_at = now()`.

> O Sinapse3 usa `fetched_at > last_normalized_at` para saber o que ainda não foi para o core. **Sempre atualize `fetched_at` no upsert.**

---

## HTTP

| Item | Valor |
| --- | --- |
| Método | `POST` |
| Path sugerido | `/webhooks/flw/:clientId` |
| Header | `X-FLW-Webhook-Secret: <secret>` |
| Body | JSON enviado pelo FLW |
| Resposta | `202 Accepted` |

### Resposta sugerida

```json
{
  "accepted": true,
  "event": "MESSAGE_RECEIVED",
  "storedSession": false,
  "storedMessage": true
}
```

Evento ignorado:

```json
{
  "accepted": false,
  "event": "UNKNOWN",
  "storedSession": false,
  "storedMessage": false
}
```

---

## Eventos suportados

| eventType | Grava |
| --- | --- |
| `SESSION_NEW` | session |
| `SESSION_UPDATE` | session |
| `SESSION_COMPLETE` | session |
| `MESSAGE_RECEIVED` | message |
| `MESSAGE_SENT` | message |
| `MESSAGE_UPDATED` | message |

Resolver tipo:

```typescript
payload.eventType ?? payload.event ?? 'UNKNOWN'
```

---

## Parse do payload

### Onde ler session/message

1. `payload.session` / `payload.message` (se existirem)
2. `payload.content` quando evento começa com `SESSION_` ou `MESSAGE_`
3. `payload.content` se passar nos guards abaixo

Se não houver `content`, usar o próprio `payload`.

### Guards

**Session** — objeto válido se:

- `id` string
- `startAt` string (ISO)

**Message** — objeto válido se:

- `id` string
- `sessionId` string
- `createdAt` string (ISO)

### Schema `payload_json` — session

```json
{
  "id": "uuid",
  "startAt": "2026-06-01T10:00:00.000Z",
  "endAt": null,
  "contactId": "uuid-contato",
  "userId": "uuid-agente",
  "agentDetails": { "email": "maria@empresa.com" },
  "status": "IN_PROGRESS",
  "departmentId": "uuid-fila"
}
```

### Schema `payload_json` — message

```json
{
  "id": "uuid",
  "sessionId": "uuid-session",
  "direction": "TO_HUB",
  "origin": "DEFAULT",
  "type": "TEXT",
  "text": "Olá",
  "userId": null,
  "createdAt": "2026-06-01T10:01:00.000Z",
  "updatedAt": "2026-06-01T10:01:00.000Z",
  "details": { "file": { "publicUrl": "https://..." } }
}
```

**Direction FLW:**

- `TO_HUB` = mensagem do cliente (inbound)
- `FROM_HUB` = outbound

---

## SQL de referência (upsert)

```sql
INSERT INTO raw.flw_sessions (id, client_id, payload_json, source, fetched_at)
VALUES ($1, $2, $3::jsonb, 'webhook', NOW())
ON CONFLICT (id) DO UPDATE SET
  payload_json = EXCLUDED.payload_json,
  source = EXCLUDED.source,
  fetched_at = NOW();

INSERT INTO raw.flw_messages (id, client_id, session_id, payload_json, source, fetched_at)
VALUES ($1, $2, $3, $4::jsonb, 'webhook', NOW())
ON CONFLICT (id) DO UPDATE SET
  payload_json = EXCLUDED.payload_json,
  source = EXCLUDED.source,
  fetched_at = NOW();
```

---

## O que NÃO fazer no serviço externo

- Não gravar em `core.messaging_sessions` / `core.messaging_messages`
- Não chamar KPIs
- Não enriquecer contato legado DKW
- Não bloquear o webhook esperando job pesado

---

## Referência de implementação (Sinapse3)

Lógica equivalente (antes da extração):

| Arquivo | Uso |
| --- | --- |
| `flw-webhook-payload.ts` | parse eventType + guards |
| `flw-webhook-ingest.service.ts` | orquestração upsert raw |
| `prisma-flw-raw.repository.ts` | Prisma upsert |
| `domain/messaging-types.ts` | `FlwSessionDto`, `FlwMessageDto` |

Pode copiar/adaptar esses arquivos para o outro serviço.

---

## Integração com Sinapse3

Após o webhook gravar no raw compartilhado (mesmo Postgres):

1. Cron externo ou agendador chama Sinapse3 a cada **30 min**:

```http
POST /internal/messaging/normalize?clientId=ferracosul
X-Job-Key: <INTERNAL_JOB_KEY>
```

2. Sinapse3 lê raw novo (`fetched_at > last_normalized_at`) e grava no core.

Ver: `docs/messaging-normalization.md`
