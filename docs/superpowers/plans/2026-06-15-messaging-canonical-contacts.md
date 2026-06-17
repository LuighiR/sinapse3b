# Messaging Canonical Contacts Implementation Plan

**Branch:** `messaging-canonical-contacts`  
**Worktree:** `.worktrees/messaging-canonical-contacts`

## Task A — Schema

- [x] Migration SQL `messaging_contacts` + `sessions.contact_id`
- [x] Prisma models + schema.spec.ts
- [x] `npm run prisma:generate`

## Task B — Contact mapper + repository

- [x] `messaging-contact-types.ts`, build id helper
- [x] DKW enricher: match `core.contacts` by id / phone
- [x] FLW mapper from session contactId
- [x] `prisma-messaging-contact.repository.ts` (upsert)

## Task C — Backfill job

- [x] Scan distinct `(client_id, provider, contact_external_id)` from sessions
- [x] Upsert contacts + link `sessions.contact_id`
- [x] `POST /internal/messaging/backfill-contacts` async 202 + GET status

## Task D — Pipeline hooks

- [x] Update FLW sync/webhook + DKW migrator to upsert contact on session write

## Task E — Tag KPIs canonical

- [x] `getTagHourlyRows` / comparison read from messaging + legacy_contact_id bridge
- [x] Tests + docs
