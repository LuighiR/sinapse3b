# Budget Follow-Up DKW Employee Webhook Design

Date: 2026-04-13
Project: Sinapse backend budget follow-up webhook routing
Status: Approved in conversation

## Goal

Route each DKW follow-up dispatch to a per-employee webhook when configured, while preserving the existing dispatch endpoint, payload, and retry behavior.

## Relationship To Existing Design

This spec extends:

- `docs/superpowers/specs/2026-04-02-budget-follow-up-dkw-dispatch-design.md`

It keeps the previously approved dispatch flow intact and changes only how the target webhook URL is resolved.

## Product Intent

The user created one webhook per employee in the external system and needs the backend dispatch to:

- use the employee-specific webhook when available
- keep a safe fallback to the existing env webhook
- avoid exposing this internal routing field in the public employee API

The user will maintain the webhook URL directly in the database for now.

## Scope

This spec covers:

- adding a nullable employee webhook column in `core.employees`
- reading that column only inside the DKW dispatch flow
- resolving the destination URL per budget row with env fallback
- keeping the current endpoint contract and payload unchanged
- keeping the current `sent_dkw_at` behavior unchanged

This spec does not cover:

- employee CRUD or API exposure for the new field
- cron scheduling
- changing the dispatch endpoint contract
- changing the DKW payload fields

## Approved Data Model Change

Add a nullable webhook column on `core.employees`.

Prisma field:

- `dkwWebhook`

Recommended database column:

- `dkw_webhook`

Reasoning:

- keeps the Prisma API idiomatic in camelCase
- keeps the database naming consistent with the existing schema style

## Webhook Resolution Rules

For each dispatch candidate:

1. try the matched employee webhook
2. if the employee is missing or the webhook is blank, fallback to `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL`
3. if both are blank, treat the send as a normal item failure

The employee lookup is internal-only and must not change the request shape of:

- `POST /kpis/budgets/follow-up/dkw-dispatch`

## Employee Match Strategy

The dispatch repository must enrich each candidate with at most one employee webhook.

Recommended lookup:

- match `core.employees.erp_id` to `core.budget_facts.seller_id`
- match `core.employees.branch_id` to `core.budget_facts.branch_id`

Why branch-aware matching is recommended:

- avoids routing a seller to the wrong webhook if ERP seller ids repeat across branches
- preserves safe fallback behavior when the budget row has no matching branch-aware employee

If no employee matches, the dispatch must continue using the env fallback.

## Application And Infrastructure Shape

### Repository

The dispatch repository should continue listing candidates from:

- `core.budget_facts`
- `raw.ferraco_budgets`

and now also bring:

- `employee.dkwWebhook`

This is still a read-only enrichment. `sent_dkw_at` remains in `raw.ferraco_budgets`.

### Service

The dispatch service should:

- resolve the destination URL per row
- send the existing payload to the resolved URL
- keep the three-consecutive-error rule unchanged

### Webhook client

The webhook client should no longer own a single fixed URL. Instead, it should receive the target URL per call.

## Testing Strategy

Required coverage:

- service tests proving employee webhook priority over env fallback
- service tests proving env fallback when employee is missing
- service tests proving env fallback when employee webhook is blank
- service tests proving failure when neither employee webhook nor env fallback is configured
- repository test updated to include the employee webhook field

## Documentation Notes

The REST API contract does not change, but internal docs can note that webhook routing now prefers the seller employee webhook and falls back to the env default.
