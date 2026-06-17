# Messaging Canonical Contacts Design

Date: 2026-06-15  
Status: Approved in conversation  
Branch: `messaging-canonical-contacts`

## Goal

Introduce provider-agnostic canonical contacts for messaging (`core.messaging_contacts`), link them to `core.messaging_sessions`, and bridge DKW contacts to legacy `core.contacts` so tag-based WhatsApp KPIs can read from the canonical model.

## Context

- `messaging_sessions` and `messaging_messages` already support `provider` (`DKW` | `FLW`).
- `messaging_sessions.contact_external_id` stores provider-specific ids but has no FK to a contact entity.
- Legacy tags live in `core.contact_tags` keyed by `core.contacts.id` (bigint).
- User is on `WHATSAPP_KPI_SOURCE=canonical` for volume KPIs; tag KPIs still use legacy joins.

## Model

### `core.messaging_contacts`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text PK | `{clientId}:{provider}:{externalContactId}` |
| `client_id` | text | tenant |
| `provider` | `messaging_provider` | `DKW` \| `FLW` |
| `external_contact_id` | text | provider id (DKW int string or FLW uuid) |
| `display_name` | text null | from legacy or FLW |
| `phone_normalized` | text null | E.164 when available |
| `legacy_contact_id` | bigint null | `core.contacts.id` dentro do mesmo `client_id` (ponte tags; FK composta no banco) |
| `raw_json` | jsonb null | snapshot |
| `created_at` / `updated_at` | timestamptz | |

Unique: `(client_id, provider, external_contact_id)`

### `core.messaging_sessions`

Add nullable FK:

- `contact_id` → `messaging_contacts.id`

Keep `contact_external_id` in v1 for backward compatibility.

## DKW enrichment (match to `core.contacts`)

Priority:

1. `external_contact_id = String(core.contacts.id)` when numeric DKW id
2. normalized phone match with `core.contacts.number`
3. via legacy ticket path when backfilling from sessions (future migrator detail)

Set `legacy_contact_id = core.contacts.id` on match.

## FLW ingestion

- From session payload `contactId` (uuid) on sync/webhook.
- Upsert `messaging_contacts` with `provider='FLW'`.
- Optional phone match to set `legacy_contact_id` (phase B+).

## Tag KPI bridge

Canonical tag queries join:

```text
messaging_sessions
  → messaging_contacts (legacy_contact_id)
  → core.contact_tags
```

FLW-only contacts without `legacy_contact_id` do not appear in tag KPIs until FLW tag sync exists.

## Jobs

- `POST /internal/messaging/backfill-contacts?clientId=...` — async 202, background job
- Idempotent upsert from distinct session contact keys + DKW enrichment

## Non-goals (v1)

- Do not delete or migrate `core.contacts` / `core.contact_tags`
- Do not sync FLW tags from API yet
- Do not unify DKW and FLW into a single contact row (separate provider rows)
