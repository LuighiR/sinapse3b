# WhatsApp Messaging KPI Design

Date: 2026-03-26
Project: Sinapse backend WhatsApp and messaging KPIs
Status: Approved in conversation

## Goal

Add a first backend KPI family for WhatsApp and messaging operations that supports:

- total conversations
- received messages
- agent ranking by handled sessions
- hourly session peaks
- hourly message peaks
- hourly tag session bars
- hourly comparison between tag sessions and open budgets

This slice is backend-only. Frontend implementation is explicitly out of scope for now.

## Product Intent

The user needs operational KPIs backed by the canonical conversational data that already exists in the `core` schema.

The implementation should stay practical:

- use the existing canonical `core` tables directly
- avoid forcing a normalization pipeline where the data is already canonical
- use Prisma as the structural contract for the domain tables
- use SQL for the heavy analytical aggregations

The KPI family should fit the current backend shape, but it does not need a materialization or refresh pipeline in the first version because:

- the source tables are already canonical
- the requested metrics are straightforward aggregations
- the current data volume is small enough for live analytical queries

## Scope

This spec covers:

- Prisma mapping for the relevant conversational entities in `core`
- query-only backend KPIs for WhatsApp and messaging
- summary, ranking, hourly, and tag comparison endpoints
- hour-bucketed comparison between tag sessions and open budgets

This spec does not cover:

- frontend dashboard work
- session/message normalization
- AI analysis of conversations
- direct linkage between a specific session and a specific budget
- historical KPI materialization in `kpi` for this first slice

## Validated Data Findings

The database was inspected before the design was finalized.

Relevant findings:

- `core.sessions` exists and currently contains 4,404 rows
- `core.messages` exists and currently contains 66,726 rows
- `core.tickets`, `core.contacts`, `core.tags`, and `core.contact_tags` provide the join path needed for tag filtering
- `core.sessions.type` is a PostgreSQL enum with values:
  - `CLOSED`
  - `OPEN_REAL`
  - `OPEN_WEAK`
  - `UNTRACKED`
- `core.messages.sender_type` is a PostgreSQL enum with values:
  - `HUMAN`
  - `SYSTEM`
  - `AI`
- tag membership is attached to contacts through `core.contact_tags`
- sessions relate to contacts through `sessions.ticket_id -> tickets.id -> tickets.contact_id`
- most recent inspected rows showed many sessions without assigned user fields, so ranking must support an unassigned fallback bucket
- `core.tags` currently has very low volume in the inspected tenant, so tag queries must tolerate empty or near-empty outputs

These findings are implementation-critical because they define the valid join path and the enum contract that should be reflected in Prisma.

## Source Model

The KPI family should read directly from canonical `core` tables:

- `core.sessions`
- `core.messages`
- `core.tickets`
- `core.contacts`
- `core.tags`
- `core.contact_tags`
- `core.budget_facts`

The first implementation should not depend on `raws` tables and should not create a new canonical fact table.

## Prisma Strategy

The recommended persistence strategy is hybrid:

- map the conversational domain tables in `prisma/schema.prisma`
- do not create new physical tables or columns for this slice
- use Prisma models and enums for structural clarity and safe simple reads
- use `prisma.$queryRaw` for the analytical queries

### Prisma mapping additions

Recommended new Prisma enums:

- `SessionType`
- `MessageSenderType`

Recommended new Prisma models:

- `Session`
- `Message`
- `Ticket`
- `Contact`
- `Tag`
- `ContactTag`

These models should map the existing `core` tables only. No migration should be generated for these mappings.

## KPI Definitions

This family should expose seven KPI surfaces.

### `whatsapp.summary`

Summary response with:

- `totalConversations.count`
- `receivedMessages.count`

Definitions:

- `totalConversations` = `count(*)` from `core.sessions` in the selected period
- `receivedMessages` = `count(*)` from `core.messages` in the selected period where:
  - `from_me = false`
  - `sender_type = 'HUMAN'`

### `whatsapp.agents_ranking`

Ranking grouped by session assignee.

Definitions:

- rank by number of sessions in the selected period
- primary identity should use:
  - `assigned_user_email` when present
  - otherwise `assigned_user_name` when present
  - otherwise an explicit unassigned fallback bucket

Recommended response fields:

- `agentKey`
- `agentLabel`
- `assignedUserName`
- `assignedUserEmail`
- `sessionsCount`

Fallback label:

- `Nao atribuido`

### `whatsapp.sessions_hourly`

Hourly series with 24 buckets from `00` to `23`.

Definition:

- bucket by `core.sessions.started_at`
- metric:
  - `sessionsCount`

### `whatsapp.messages_hourly`

Hourly series with 24 buckets from `00` to `23`.

Definition:

- bucket by `core.messages.created_at_external`
- metric:
  - `receivedMessagesCount`

Only received human messages should count:

- `from_me = false`
- `sender_type = 'HUMAN'`

### `whatsapp.tags`

List of tags available for the active client, ordered by name.

Recommended response fields:

- `tagId`
- `tagName`
- `color`

This endpoint exists to support tag-driven charts and filters.

### `whatsapp.tags_hourly`

Hourly series for a specific tag.

Definition:

- sessions counted by hour using `core.sessions.started_at`
- only sessions whose ticket contact belongs to the selected tag should count

Join path:

- `sessions.ticket_id = tickets.id`
- `tickets.contact_id = contact_tags.contact_id`
- `tickets.client_id = contact_tags.client_id`
- `contact_tags.tag_id = tags.id`

Metrics:

- `sessionsCount`

### `whatsapp.tags_hourly_comparison`

Hourly comparison between:

- sessions for a selected tag
- open budgets in the same period

Important approved rule:

- this is a temporal comparison only
- there is no direct linkage between a specific tagged session and a specific budget

Definitions:

- tag session series:
  - same logic as `whatsapp.tags_hourly`
- open budget series:
  - `count(*)` from `core.budget_facts`
  - filtered by `status_normalized = 'OPEN'`
  - bucketed by `budget_datetime` hour

Metrics per bucket:

- `tagSessionsCount`
- `openBudgetsCount`

## Period and Hour Rules

All endpoints should accept:

- `from`
- `to`

Hour-based outputs should:

- group only by hour
- ignore minute and second differences
- always return fixed zero-filled buckets from `00` to `23`
- use the timestamps stored in the database consistently

For the first implementation, the hour extraction behavior should match the existing KPI backend conventions already used in budget and call queries.

## Query Strategy

This family should be query-driven instead of refresh-driven in the first version.

Recommended strategy:

- keep all heavy aggregations inside one repository dedicated to WhatsApp KPIs
- implement the aggregations with SQL and `GROUP BY`
- keep filters parameterized through Prisma to avoid SQL injection risk
- use Prisma model access only where simple list or existence reads are enough

Recommended repository shape:

- `listTags`
- `getSummary`
- `getAgentRanking`
- `getSessionsHourly`
- `getMessagesHourly`
- `getTagHourly`
- `getTagHourlyComparison`

## API Surface

Recommended controller root:

- `kpis/whatsapp`

### `GET /kpis/whatsapp/summary`

Returns:

- `totalConversations`
- `receivedMessages`

### `GET /kpis/whatsapp/agents/ranking`

Returns ranking rows ordered by:

- `sessionsCount desc`
- then label asc

### `GET /kpis/whatsapp/sessions/hourly`

Returns 24 rows for hours `00` through `23` with:

- `sessionsCount`

### `GET /kpis/whatsapp/messages/hourly`

Returns 24 rows for hours `00` through `23` with:

- `receivedMessagesCount`

### `GET /kpis/whatsapp/tags`

Returns the available tags for the active client.

### `GET /kpis/whatsapp/tags/hourly`

Accepted query contract:

- `from`
- `to`
- `tagId`

Returns 24 rows for hours `00` through `23` with:

- `sessionsCount`

### `GET /kpis/whatsapp/tags/hourly/comparison`

Accepted query contract:

- `from`
- `to`
- `tagId`

Returns 24 rows for hours `00` through `23` with:

- `tagSessionsCount`
- `openBudgetsCount`

## Recommended Code Shape

The implementation should stay inside the existing KPI module for this first slice.

Recommended additions:

- `src/modules/kpi/application/whatsapp-kpi-query.service.ts`
- `src/modules/kpi/application/whatsapp-kpi-query.service.spec.ts`
- `src/modules/kpi/presentation/whatsapp-kpi.controller.ts`
- `src/modules/kpi/presentation/query/whatsapp-summary.query.ts`
- `src/modules/kpi/presentation/query/whatsapp-agent-ranking.query.ts`
- `src/modules/kpi/presentation/query/whatsapp-sessions-hourly.query.ts`
- `src/modules/kpi/presentation/query/whatsapp-messages-hourly.query.ts`
- `src/modules/kpi/presentation/query/whatsapp-tag-hourly.query.ts`
- `src/modules/kpi/presentation/query/whatsapp-tag-hourly-comparison.query.ts`

Recommended infrastructure addition:

- `src/modules/kpi/infrastructure/prisma-whatsapp-kpi.repository.ts`

Recommended Prisma additions:

- conversational enums and models in `prisma/schema.prisma`

## Testing Priorities

Tests should cover both KPI correctness and join behavior.

Required test focus:

- summary counts for sessions and received messages
- exclusion of outbound or system messages from `receivedMessages`
- zero-filled hourly session output
- zero-filled hourly message output
- ranking grouped by assignee email and name
- fallback ranking row for unassigned sessions
- tag session aggregation through `tickets -> contact_tags`
- tag hourly series for a selected tag
- tag hourly comparison with open budgets
- handling of empty tag result sets
- controller query validation for period and `tagId`

## Success Criteria

This KPI family is successful when:

- the backend exposes WhatsApp and messaging KPIs without frontend dependency
- the Prisma schema documents the conversational tables and enums already present in `core`
- heavy aggregations are implemented in SQL rather than forced through ORM-only queries
- total conversations and received messages follow the approved business definitions
- agent ranking handles missing assignment data gracefully
- hourly charts always return 24 buckets
- tag charts work through the canonical contact-tag join path
- the tag versus budget comparison is purely hour-based and does not attempt record-level linkage
- the implementation fits the current NestJS KPI module structure without introducing unnecessary materialization
