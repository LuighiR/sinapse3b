# Webhook FLW — receber mensagem e salvar no banco

Escopo **somente** da entrada HTTP do webhook FLW até a persistência em **`raw.flw_sessions`** / **`raw.flw_messages`**.

Use este doc para extrair um módulo isolado (ex.: `FlwWebhookModule`) sem migrador DKW, sync API, contatos canônicos ou KPIs.

---

## O que este fluxo faz

1. Recebe `POST` do FLW/WTS Chat com JSON do evento
2. Valida secret (opcional)
3. Identifica o tipo de evento
4. Extrai session e/ou message do payload
5. Faz **upsert** nas tabelas raw (`source = 'webhook'`)

**O que fica fora deste escopo (mas existe hoje acoplado):** após salvar no raw, o código chama `MessagingNormalizationService.normalizeClient()` e grava em `core.messaging_*`. Ao modularizar só o webhook, essa chamada pode sair ou virar evento/job separado.

---

## Endpoint

| Item | Valor |
| --- | --- |
| Método | `POST` |
| Rota | `/webhooks/flw/:clientId` |
| Resposta | `202 Accepted` |
| Body | JSON do webhook FLW |
| Header auth | `X-FLW-Webhook-Secret` (obrigatório se `FLW_WEBHOOK_SECRET` estiver setado no `.env`) |

**Exemplo:**

```http
POST /webhooks/flw/ferracosul
X-FLW-Webhook-Secret: seu-secret
Content-Type: application/json

{ "eventType": "MESSAGE_RECEIVED", "content": { ... } }
```

---

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `FLW_WEBHOOK_SECRET` | Se não vazio, exige header igual; se vazio, auth desligada |
| `FLW_WEBHOOK_DEBUG` | `true`/`1` → loga payload JSON completo |
| `DATABASE_URL` | Postgres (schema `raw`) |

Não usa `FLW_CHAT_API_TOKEN` (isso é do sync API, outro fluxo).

---

## Arquivos envolvidos (só webhook → raw)

```text
src/modules/messaging/
├── presentation/
│   └── flw-webhook.controller.ts          # HTTP: auth + delega ingest
├── application/
│   ├── flw-webhook-ingest.service.ts      # Orquestra parse + upsert raw
│   ├── flw-webhook-payload.ts             # eventType, extract content, guards
│   └── flw-webhook.logger.ts              # Logs [flw-webhook]
├── infrastructure/
│   └── prisma-flw-raw.repository.ts       # upsertSession / upsertMessage
└── domain/
    └── messaging-types.ts                 # FlwSessionDto, FlwMessageDto (tipos mínimos)
```

**Testes:**

- `presentation/flw-webhook.controller.spec.ts`
- `application/flw-webhook-ingest.service.spec.ts`
- `application/flw-webhook-payload.spec.ts`

**Migration:**

- `prisma/migrations/20260615_add_raw_flw_messaging_tables.sql`

**Módulo Nest hoje:** tudo registrado em `messaging.module.ts` junto com sync/migrate/contatos.

---

## Fluxo passo a passo

```text
FlwWebhookController
  │
  ├─ logFlwWebhookReceived(clientId, payload)
  ├─ valida X-FLW-Webhook-Secret vs FLW_WEBHOOK_SECRET
  │
  └─ FlwWebhookIngestService.ingest({ clientId, payload })
        │
        ├─ resolveFlwWebhookEventType(payload)
        │     → payload.eventType ou payload.event ou 'UNKNOWN'
        │
        ├─ se evento ∉ SUPPORTED_EVENTS → accepted: false (202, ignorado)
        │
        ├─ extractSession(payload, event) → FlwSessionDto | null
        ├─ extractMessage(payload, event) → FlwMessageDto | null
        │
        ├─ se session → PrismaFlwRawRepository.upsertSession(..., source: 'webhook')
        ├─ se message → PrismaFlwRawRepository.upsertMessage(..., source: 'webhook')
        │
        └─ [acoplamento atual] MessagingNormalizationService.normalizeClient(clientId)
```

---

## Eventos aceitos

| Evento | Costuma trazer |
| --- | --- |
| `SESSION_NEW` | session |
| `SESSION_UPDATE` | session |
| `SESSION_COMPLETE` | session |
| `MESSAGE_RECEIVED` | message |
| `MESSAGE_SENT` | message |
| `MESSAGE_UPDATED` | message |

Outros eventos → log `[flw-webhook] ignored`, resposta `accepted: false`.

---

## Como o payload é lido

### Tipo do evento

```typescript
payload.eventType  // preferido
payload.event      // fallback
```

### Onde está session/message

Ordem de busca (simplificado):

1. `payload.session` / `payload.message` (objeto aninhado)
2. `payload.content` (se existir) quando o evento começa com `SESSION_` ou `MESSAGE_`
3. O próprio `content` se passar nos guards

Helpers em `flw-webhook-payload.ts`:

- `extractFlwWebhookContent(payload)` — usa `payload.content` ou o payload inteiro
- `isFlwSessionContent` — exige `id` + `startAt` (string)
- `isFlwMessageContent` — exige `id` + `sessionId` + `createdAt` (string)

### Campos mapeados

**Session (`FlwSessionDto`):**

| Campo | Origem payload |
| --- | --- |
| `id` | `id` (uuid) |
| `startAt` | `startAt` |
| `endAt` | `endAt` ou null |
| `contactId` | `contactId` |
| `userId` | `userId` |
| `agentDetails.email` | atendente |
| `status` | `status` (default `UNDEFINED`) |
| `departmentId` | fila FLW |

**Message (`FlwMessageDto`):**

| Campo | Origem payload |
| --- | --- |
| `id` | uuid da mensagem |
| `sessionId` | uuid da session |
| `direction` | `FROM_HUB` / `TO_HUB` |
| `origin` | `BOT`, `API`, `DEFAULT`, etc. |
| `type` | `TEXT`, mídia, etc. |
| `text` | corpo |
| `createdAt` / `updatedAt` | timestamps |
| `details.file.publicUrl` | mídia (opcional) |

---

## O que é gravado no banco

### `raw.flw_sessions`

| Coluna | Valor |
| --- | --- |
| `id` | uuid da session FLW (PK) |
| `client_id` | `:clientId` da URL |
| `payload_json` | `FlwSessionDto` serializado |
| `source` | `'webhook'` |
| `fetched_at` | now (atualiza no upsert) |

**Upsert:** mesma `id` → atualiza JSON + `fetched_at`.

### `raw.flw_messages`

| Coluna | Valor |
| --- | --- |
| `id` | uuid da mensagem (PK) |
| `client_id` | tenant |
| `session_id` | uuid da session |
| `payload_json` | `FlwMessageDto` serializado |
| `source` | `'webhook'` |
| `fetched_at` | now |

**Upsert:** idempotente por `id` da mensagem.

> Sync API usa o **mesmo repositório** com `source = 'api_sync'` — outro fluxo, mesmas tabelas.

---

## Logs (`[flw-webhook]`)

| Log | Quando |
| --- | --- |
| `received` | Toda requisição (event + contentKeys) |
| `payload` | Só com `FLW_WEBHOOK_DEBUG=true` |
| `auth failed` | Secret inválido → 401 |
| `ignored` | Evento não suportado |
| `stored session` / `stored message` | Após upsert raw |
| `no extractable content` | Evento aceito mas sem session/message parseável |
| `normalized` | Após normalização (acoplamento atual) |
| `failed` | Erro → exceção propagada |

---

## Resposta HTTP

**Evento ignorado (202):**

```json
{
  "accepted": false,
  "event": "UNKNOWN",
  "normalizedSessions": 0,
  "normalizedMessages": 0
}
```

**Evento processado (202):**

```json
{
  "accepted": true,
  "event": "MESSAGE_RECEIVED",
  "normalizedSessions": 1,
  "normalizedMessages": 1
}
```

Os campos `normalized*` vêm da normalização acoplada; se extrair só o webhook, a resposta pode ficar só com `accepted` + `event` + flags `storedSession` / `storedMessage`.

---

## Dependências Nest mínimas para o módulo isolado

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [FlwWebhookController],
  providers: [
    FlwWebhookIngestService,
    PrismaFlwRawRepository,
  ],
  exports: [FlwWebhookIngestService], // opcional
})
export class FlwWebhookModule {}
```

**Remover do ingest ao isolar:**

```typescript
// flw-webhook-ingest.service.ts — dependência a tirar
private readonly normalizationService: MessagingNormalizationService
await this.normalizationService.normalizeClient(input.clientId)
```

**Manter:**

- `PrismaModule` + `PrismaService`
- Tipos `FlwSessionDto` / `FlwMessageDto` (podem ir para `domain/flw-webhook-types.ts`)

---

## Checklist para novo módulo

- [ ] Copiar/mover os 5 arquivos listados acima
- [ ] Registrar `FlwWebhookModule` no `AppModule`
- [ ] Garantir migration `raw.flw_*` aplicada
- [ ] Configurar `FLW_WEBHOOK_SECRET` + URL no painel FLW
- [ ] Decidir: normalização síncrona no webhook vs job async (recomendado desacoplar)
- [ ] Testes unitários do controller + payload + ingest (mock só `PrismaFlwRawRepository`)

---

## Consultas úteis pós-webhook

```sql
-- últimas mensagens recebidas via webhook
SELECT id, session_id, fetched_at
FROM raw.flw_messages
WHERE client_id = 'ferracosul' AND source = 'webhook'
ORDER BY fetched_at DESC
LIMIT 20;

-- sessions webhook vs api_sync
SELECT source, count(*)
FROM raw.flw_sessions
WHERE client_id = 'ferracosul'
GROUP BY source;
```
