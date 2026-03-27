# WhatsApp ChatId Filter Design

Date: 2026-03-27
Project: Sinapse backend WhatsApp KPI direct attendant filters
Status: Approved in conversation

## Goal

Extend the existing WhatsApp KPI contract so the frontend can filter WhatsApp analytics directly by attendant email through `chatId`, without resolving `employees` first.

Additionally, allow `GET /kpis/whatsapp/tags/hourly/comparison` to accept `sellerId` so the budget side of the comparison can be filtered by the attendant ERP identifier that the frontend already uses for budgets and sales.

## Relationship To Existing Design

This spec is an additive extension to:

- `docs/superpowers/specs/2026-03-26-whatsapp-messaging-kpi-design.md`

It does not replace the original WhatsApp KPI design. It only adds direct filter semantics for the already approved endpoints.

## Product Intent

The user wants the WhatsApp endpoints to behave like the updated calls endpoints:

- the frontend passes the channel-specific identifier directly
- the backend filters the KPI query directly with that identifier
- no internal lookup from `sellerId -> employee -> chat/email` is required for WhatsApp metrics

For WhatsApp, the direct identifier is:

- `chatId`

In practice, the current tenant uses the attendant email as the `chatId`, so the filter should be resolved through the session assignee email stored in canonical conversation data.

## Scope

This spec covers:

- adding `chatId` as an optional query parameter to WhatsApp KPI period endpoints
- applying the `chatId` filter directly in repository queries
- adding optional `sellerId` to `GET /kpis/whatsapp/tags/hourly/comparison`
- documenting the new contract in `docs/api/rest-api.md`
- automated tests for parser, service/controller wiring, and repository SQL contract

This spec does not cover:

- changing the tags list endpoint
- adding employee lookups to WhatsApp queries
- changing the existing ranking response shape
- changing budget or sales query contracts again

## Approved Query Contract

### WhatsApp period endpoints

The following routes should accept:

- `from` required
- `to` required
- `chatId` optional

Routes:

- `GET /kpis/whatsapp/summary`
- `GET /kpis/whatsapp/agents/ranking`
- `GET /kpis/whatsapp/sessions/hourly`
- `GET /kpis/whatsapp/sessions/daily`
- `GET /kpis/whatsapp/messages/hourly`
- `GET /kpis/whatsapp/messages/daily`
- `GET /kpis/whatsapp/tags/hourly`
- `GET /kpis/whatsapp/tags/hourly/comparison`

### Tag endpoints

`GET /kpis/whatsapp/tags/hourly` should accept:

- `from`
- `to`
- `tagId`
- `chatId` optional

`GET /kpis/whatsapp/tags/hourly/comparison` should accept:

- `from`
- `to`
- `tagId`
- `chatId` optional
- `sellerId` optional

### Budget side semantics in comparison

When `sellerId` is sent to `GET /kpis/whatsapp/tags/hourly/comparison`, it should filter `openBudgetsCount` by:

- `core.budget_facts.seller_id`

This is the same value documented in the REST API for budgets and sales:

- `sellerId = core.employees.erp_id`

## Filter Resolution Rules

### `chatId`

`chatId` should be normalized as:

- trim whitespace
- compare case-insensitively

The direct match target should be:

- `lower(btrim(core.sessions.assigned_user_email))`

This is the approved direct path because the user wants the frontend to pass the attendant email directly.

### No filter case

When `chatId` is absent:

- all WhatsApp endpoints keep the current behavior exactly as-is

When `sellerId` is absent in the tag comparison route:

- the budget side also keeps the current behavior exactly as-is

## Endpoint Behavior

### Summary

`GET /kpis/whatsapp/summary`

When `chatId` is present:

- `totalConversations` counts only sessions whose normalized `assigned_user_email` matches `chatId`
- `receivedMessages` counts only human inbound messages attached to sessions whose normalized `assigned_user_email` matches `chatId`

Important implementation note:

- tenant scope must stay anchored in `core.messages.ticket_id -> core.tickets.id -> core.tickets.client_id`
- assignee filtering should add the direct join `core.messages.session_id -> core.sessions.id`
- filtered message queries should keep both conditions at the same time:
  - `tickets.client_id = clientId`
  - normalized `sessions.assigned_user_email = chatId`
- when a `chatId` filter is active, messages without `session_id` should not be counted because they cannot be safely attributed to a specific attendant

### Agent ranking

`GET /kpis/whatsapp/agents/ranking`

When `chatId` is present:

- ranking should only include rows whose normalized `assigned_user_email` matches `chatId`
- unassigned rows should naturally disappear under this filter because they do not match the requested email

### Session series

`GET /kpis/whatsapp/sessions/hourly`
`GET /kpis/whatsapp/sessions/daily`

When `chatId` is present:

- count only sessions whose normalized `assigned_user_email` matches `chatId`

### Message series

`GET /kpis/whatsapp/messages/hourly`
`GET /kpis/whatsapp/messages/daily`

When `chatId` is present:

- count only received human messages whose linked session matches the normalized `assigned_user_email`
- messages without a linked session should be excluded under filtered mode

### Tag hourly

`GET /kpis/whatsapp/tags/hourly`

When `chatId` is present:

- keep the current tag join path
- add the direct assignee email filter on `core.sessions.assigned_user_email`

### Tag hourly comparison

`GET /kpis/whatsapp/tags/hourly/comparison`

When `chatId` is present:

- `tagSessionsCount` should be filtered by the normalized assignee email

When `sellerId` is present:

- `openBudgetsCount` should be filtered by `core.budget_facts.seller_id`

Important approved rule:

- this endpoint remains a temporal comparison only
- there is still no record-level linkage between a tagged conversation and a specific budget

## Recommended Code Shape

### Presentation layer

Modify query parsers to accept:

- `chatId?: string` in the WhatsApp period parsers
- `chatId?: string` in the WhatsApp tag hourly parser
- `chatId?: string` and `sellerId?: number` in a comparison-specific WhatsApp tag comparison parser

Controller methods should simply pass the new optional filters through to the query service.

### Application layer

Extend the WhatsApp query input types so every period-based service method can receive:

- `chatId?: string`

Keep `WhatsAppKpiTagHourlyInput` focused on:

- `from`
- `to`
- `tagId`
- `chatId?: string`

Define a dedicated `WhatsAppKpiTagHourlyComparisonInput` so the comparison route can also receive:

- `sellerId?: string | number | bigint`

The service should not resolve employees. It should only:

- validate and normalize `sellerId` for the comparison route
- pass normalized filters to the repository

### Repository layer

Repository methods should accept optional direct filters and embed them into SQL conditionals.

Recommended rules:

- use parameterized SQL through `Prisma.sql`
- keep the current queries intact when filters are absent
- add `sessions.assigned_user_email` filtering only where the metric is session-attributed
- add `budget_facts.seller_id` filtering only in the budget branch of the tag comparison query

## Error Handling

Validation should stay simple:

- `chatId` optional, trimmed, empty string becomes absent
- `sellerId` optional only on tag comparison and validated with the same safe integer rules already used in other KPI parsers
- invalid periods still return the current `400` errors
- invalid `tagId` still returns the current `400` errors

## Testing Strategy

Required coverage:

- parser tests for `chatId` acceptance and optional `sellerId` on comparison
- service tests proving the new filters are passed to the repository
- repository tests proving the SQL path supports filtered mode
- e2e/controller tests proving the new query params reach the service contract
- REST API doc updates for the new query params and semantics

Important regression checks:

- no-filter requests must still behave exactly as before
- zero-filled hourly and daily responses must remain unchanged
- filtered message metrics must exclude messages without a linked session when `chatId` is active

## Success Criteria

This work is successful when:

- the frontend can call WhatsApp KPI routes with `chatId=<attendant-email>` directly
- WhatsApp routes return filtered results without any employee lookup step
- tag comparison can optionally filter the budget side with `sellerId=<employees.erp_id>`
- requests without these filters keep the current results
- the REST documentation clearly explains both `chatId` and the optional `sellerId` on the comparison route
