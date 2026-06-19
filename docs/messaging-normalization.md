# Normalização FLW — raw → core

Este serviço (Sinapse3) **não recebe webhook FLW**. Ele lê **`raw.flw_*`** e grava no modelo canônico:

- `core.messaging_sessions`
- `core.messaging_messages`
- `core.messaging_contacts` (+ `contact_id` na session)

O webhook fica no **serviço externo** — ver `docs/flw-webhook-external-service.md`.

---

## Endpoint

```http
POST /internal/messaging/normalize?clientId=ferracosul
X-Job-Key: <INTERNAL_JOB_KEY>
```

| Query | Obrigatório | Descrição |
| --- | --- | --- |
| `clientId` | sim | tenant |
| `full` | não | `true` reprocessa **todo** o raw; omitir = incremental |

**Resposta 200:**

```json
{
  "clientId": "ferracosul",
  "mode": "incremental",
  "since": "2026-06-17T21:30:00.000Z",
  "lastNormalizedAt": "2026-06-17T22:00:00.000Z",
  "sessionsRead": 12,
  "sessionsWritten": 12,
  "messagesRead": 48,
  "messagesWritten": 45,
  "messagesSkippedMissingSession": 3
}
```

| Campo | Significado |
| --- | --- |
| `mode` | `incremental` ou `full` |
| `since` | watermark anterior (`last_normalized_at`); null na 1ª execução |
| `lastNormalizedAt` | novo watermark gravado ao fim |
| `messagesSkippedMissingSession` | message no raw sem session correspondente |

---

## Incremental (padrão)

Controle em `core.messaging_sync_states.last_normalized_at`:

1. Lê sessions/messages com **`fetched_at > last_normalized_at`**
2. Upsert canônico (idempotente)
3. Atualiza `last_normalized_at = now()` do início do job

**Primeira execução** (`last_normalized_at` null): processa **todo** o raw (= `mode: full`).

**Reprocessar tudo de propósito:**

```http
POST /internal/messaging/normalize?clientId=ferracosul&full=true
```

---

## O que a normalização faz

```text
raw.flw_sessions (incremental ou full)
  → mapFlwSessionToCanonical
  → MessagingContactService.upsertSessionWithContact
  → core.messaging_sessions + messaging_contacts

raw.flw_messages (incremental ou full)
  → mapFlwMessageToCanonical
  → core.messaging_messages
  (usa mapa de TODAS as sessions raw do client para resolver sessionId)
```

Logs: `[messaging-normalize] completed clientId=... mode=...`

---

## Cron sugerido (30 minutos)

Exemplo Linux crontab:

```cron
*/30 * * * * curl -sS -X POST "https://api.seudominio.com/internal/messaging/normalize?clientId=ferracosul" -H "X-Job-Key: SEU_INTERNAL_JOB_KEY"
```

PowerShell (Task Scheduler):

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.seudominio.com/internal/messaging/normalize?clientId=ferracosul" `
  -Headers @{ "X-Job-Key" = $env:INTERNAL_JOB_KEY }
```

Ajuste intervalo no cron do SO — **não há scheduler embutido no Nest** neste projeto.

---

## Migrations necessárias

1. Tabelas raw: `20260615_add_raw_flw_messaging_tables.sql`
2. Tabelas core messaging + contatos: migrations `20260615_*`, `20260617_*`
3. Watermark: `20260618_add_last_normalized_at_to_messaging_sync_state.sql`

```powershell
npx prisma db execute --file prisma/migrations/20260618_add_last_normalized_at_to_messaging_sync_state.sql
npm run prisma:generate
```

---

## Arquivos principais

| Arquivo | Papel |
| --- | --- |
| `messaging-normalization.service.ts` | Orquestra raw → core incremental |
| `flw-message-mapper.ts` | Mapeamento FLW → canônico |
| `messaging-contact.service.ts` | Contato + session |
| `prisma-flw-raw.repository.ts` | Leitura raw (`*Since`) |
| `prisma-messaging-canonical.repository.ts` | Escrita core + sync state |
| `internal-messaging-sync.controller.ts` | `POST /normalize` |

---

## Jobs relacionados (opcionais)

| Endpoint | Quando usar |
| --- | --- |
| `POST /internal/messaging/backfill-contacts` | Ligar `contact_id` em sessions antigas |
| `POST /internal/messaging/migrate-dkw` | Histórico DKW legado → canônico |
| `GET /internal/messaging/parity` | Validar paridade DKW |

Normalização FLW e migrador DKW são fluxos **independentes**.

---

## Validar

```sql
-- watermark
SELECT client_id, last_normalized_at, last_success_at, last_error
FROM core.messaging_sync_states
WHERE client_id = 'ferracosul';

-- raw pendente (approx: fetched depois do watermark)
SELECT count(*) FROM raw.flw_messages m
WHERE m.client_id = 'ferracosul'
  AND m.fetched_at > (
    SELECT last_normalized_at FROM core.messaging_sync_states WHERE client_id = 'ferracosul'
  );
```
