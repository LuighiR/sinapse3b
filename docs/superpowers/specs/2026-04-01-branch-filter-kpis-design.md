# KPI Branch Filter Design

Date: 2026-04-01
Project: Sinapse backend branch filtering across KPI families
Status: Approved in conversation

## Goal

Extend the KPI backend contract so a single optional `branchId` filter can be applied consistently across:

- budgets
- sales
- calls
- whatsapp

This work is backend-only. The frontend should remain compatible and only needs to append `branchId` to KPI requests when a branch filter is selected.

## Relationship To Existing Design

This spec extends the already approved KPI designs, especially:

- `docs/superpowers/specs/2026-03-24-sinapse-live-kpi-cockpit-design.md`
- `docs/superpowers/specs/2026-03-25-calls-kpi-design.md`
- `docs/superpowers/specs/2026-03-26-whatsapp-messaging-kpi-design.md`
- `docs/superpowers/specs/2026-03-27-whatsapp-chatid-filter-design.md`

It does not replace those documents. It adds a shared branch-scoping rule to the existing KPI contracts.

## Product Intent

The user wants branch filtering to behave as a shared backend capability:

- branch selection is single-select for now
- the frontend may keep its current flow and only send `branchId` when filtering is needed
- requests without `branchId` must behave exactly as they do today
- when `branchId` is present, only records attributable to that branch should remain
- records that cannot be mapped to a branch must disappear under filtered mode

Important approved business rule:

- if a call or WhatsApp record does not resolve to an employee in the selected branch, it must not appear in the filtered result

## Scope

This spec covers:

- adding optional `branchId` query support to KPI routes across budgets, sales, calls, and whatsapp
- applying direct branch filtering to budget and sale facts
- applying employee-derived branch filtering to calls and whatsapp
- preserving current behavior when `branchId` is absent
- validating branch scope against the active client
- documenting the new contract in `docs/api/rest-api.md`
- adding automated coverage for parser, service, repository, and controller behavior

This spec does not cover:

- frontend UI changes
- multi-select branch filtering
- adding `branchName` as a new shared filter outside existing drilldown behavior
- schema migrations to persist branch ids directly on call facts or WhatsApp-specific facts
- retrofitting a new materialized KPI layer for calls or whatsapp

## Approved Query Contract

### Shared filter

The backend should accept:

- `branchId` optional, integer, single value

Requests without `branchId` keep the current behavior.

Requests with `branchId` return only records attributable to that branch and inside the authenticated client scope.

### Budget routes

Add `branchId` optional to:

- `GET /kpis/budgets/summary`
- `GET /kpis/budgets/daily`
- `GET /kpis/budgets/hourly`
- `GET /kpis/budgets/channel/daily`
- `GET /kpis/budgets/channel/hourly`
- `GET /kpis/budgets/channel/abandonment`
- `GET /kpis/budgets/follow-up/summary`
- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`
- `GET /kpis/budgets/drilldown`

Note:

- `GET /kpis/budgets/drilldown` already supports branch-specific fields. This spec aligns the rest of the budget family with the same branch filter capability.

### Sales routes

Add `branchId` optional to:

- `GET /kpis/sales/summary`
- `GET /kpis/sales/daily`
- `GET /kpis/sales/channel/daily`
- `GET /kpis/sales/ticket-average`
- `GET /kpis/sales/drilldown`

### Call routes

Add `branchId` optional to:

- `GET /kpis/calls/summary`
- `GET /kpis/calls/hourly`
- `GET /kpis/calls/agents/ranking`
- `GET /kpis/calls/hourly/comparison`

### WhatsApp routes

Add `branchId` optional to:

- `GET /kpis/whatsapp/summary`
- `GET /kpis/whatsapp/agents/ranking`
- `GET /kpis/whatsapp/sessions/hourly`
- `GET /kpis/whatsapp/sessions/daily`
- `GET /kpis/whatsapp/messages/hourly`
- `GET /kpis/whatsapp/messages/daily`
- `GET /kpis/whatsapp/tags/hourly`
- `GET /kpis/whatsapp/tags/hourly/comparison`

## Filter Semantics

### No filter

When `branchId` is absent:

- all KPI families keep the current behavior exactly as-is

### Budgets and sales

When `branchId` is present:

- budgets should filter by `core.budget_facts.branch_id`
- sales should filter by `core.sale_facts.branch_id`

This branch filter composes with existing filters such as:

- `sellerId`
- `status`
- `orderType`
- `hasLinkedBudget`

The result is the intersection of all provided filters.

### Calls

When `branchId` is present:

- include only call records that can be attributed to an employee in the selected branch
- exclude records with no employee match
- exclude records whose employee mapping is ambiguous

Approved resolution path:

- first try employee match by `core.employees.extension_uuid = core.call_facts.extension_uuid`
- then fallback to employee match by `core.employees.extension_number` against the call-side extension number identity already used by calls

The selected branch should be enforced through the employee relation:

- `core.employees.branch_id = branchId`

Important behavior:

- this filter is employee-derived, not fact-native
- unmatched lost calls should disappear under branch-filtered mode

### Calls hourly comparison

`GET /kpis/calls/hourly/comparison` has two logical sides:

- calls side
- telemarketing budget side

When `branchId` is present:

- the calls side should use the employee-derived branch filter described above
- the telemarketing budget side should filter by `core.budget_facts.branch_id = branchId`

This keeps the comparison scoped to the same selected branch.

### WhatsApp

When `branchId` is present:

- include only WhatsApp records attributable to employees in the selected branch
- exclude records with no employee match
- exclude records with ambiguous employee matches

Approved resolution path:

- resolve employees by normalized attendant identity:
  - `lower(btrim(core.employees.chat_id))`
- match against the normalized assignee identity already used in WhatsApp queries:
  - `lower(btrim(core.sessions.assigned_user_email))`

The selected branch should be enforced through:

- `core.employees.branch_id = branchId`

Important behavior:

- sessions or messages without a resolvable employee mapping should not count when `branchId` is active
- unassigned or unmatched rows should naturally disappear under filtered mode

### Single-select only

For this phase:

- only one `branchId` value is supported
- arrays, comma-separated lists, or repeated branch params are out of scope

## Validation And Scope Rules

`branchId` should:

- be optional
- use the same safe integer parsing strategy already used by other KPI filters
- return `400` on invalid format

When `branchId` is provided, the backend should verify it belongs to the active client. If not:

- return the same scoped authorization error style already used by employee branch filtering

Recommended rule:

- reuse the existing branch scope validation approach already present in company/employee services, or extract a shared branch scope helper if that reduces duplication cleanly

## Recommended Code Shape

### Presentation layer

Extend the query parsers so they accept optional `branchId` where applicable.

Recommended parser structure:

- budgets and sales reuse shared numeric parsing for `branchId`
- calls extend the existing call filter parser with `branchId?: number`
- whatsapp period and tag parsers extend their current query shapes with `branchId?: number`

Controller methods should pass the new filter through without introducing business logic.

### Application layer

Extend query input types to include optional `branchId`.

Recommended behavior by family:

- budgets: pass `branchId` into fact queries and follow-up queries
- sales: pass `branchId` into fact and drilldown queries
- calls: normalize `branchId`, validate scope, and route it to repository-level filtering
- whatsapp: normalize `branchId`, validate scope, and route it to repository-level filtering

The service layer should preserve the current no-filter behavior and only activate branch-specific filtering when `branchId` is present.

### Repository layer

#### Budgets and sales

Add direct fact filtering by `branchId` in repository methods that already query:

- `core.budget_facts`
- `core.sale_facts`

#### Calls

Do not load all facts and filter in application memory when branch filtering is active.

Preferred approach:

- extend repository methods to accept `branchId`
- resolve employee attribution inside the repository query path
- return only call facts attributable to employees in the selected branch

Recommended implementation shape:

- build the current call fact result set for the requested period
- join or correlate against `core.employees` constrained by `branch_id = branchId` and the active client
- preserve the current extension UUID first, extension number fallback logic
- treat ambiguous employee matches as non-attributable in branch-filtered mode

#### WhatsApp

Apply branch filtering directly in the SQL query path.

Preferred approach:

- extend repository methods to accept `branchId`
- constrain the SQL using an employee lookup CTE or equivalent join path
- match normalized `sessions.assigned_user_email` to normalized `employees.chat_id`
- enforce `employees.branch_id = branchId`
- leave current query structure intact when `branchId` is absent

## Suggested Public Contract Examples

- `GET /kpis/budgets/summary?from=2026-03-01&to=2026-03-31&branchId=5`
- `GET /kpis/sales/summary?from=2026-03-01&to=2026-03-31&branchId=5&sellerId=35747`
- `GET /kpis/calls/summary?from=2026-03-01&to=2026-03-31&branchId=5`
- `GET /kpis/calls/hourly/comparison?from=2026-03-01&to=2026-03-31&branchId=5`
- `GET /kpis/whatsapp/sessions/daily?from=2026-03-01&to=2026-03-31&branchId=5`
- `GET /kpis/whatsapp/tags/hourly/comparison?from=2026-03-01&to=2026-03-31&tagId=21830&branchId=5`

## Integration Impact

This design is intentionally backend-only for now.

Expected frontend impact:

- no request shape changes unless the UI chooses to send `branchId`
- existing screens and calls remain valid
- future branch-aware seller dropdowns may optionally call:
  - `GET /companies/current/employees?branchId=<id>`

That employee endpoint behavior already exists and does not need to be changed for this spec.

## Error Handling

Keep validation simple and explicit:

- invalid `branchId` format returns `400`
- out-of-scope `branchId` returns the existing branch scope authorization failure style
- no special fallback bucket such as `Sem filial` should be introduced

Important approved rule:

- filtered mode is strict
- unknown, unmatched, or ambiguous branch attribution means exclusion from results

## Testing Strategy

Required coverage:

- parser tests for new `branchId` acceptance on each KPI family
- service tests proving `branchId` is normalized and propagated correctly
- repository tests proving SQL/query filtering honors branch scope
- regression tests proving requests without `branchId` keep existing results
- filtered-mode tests proving unmatched records disappear in calls and whatsapp
- documentation updates in `docs/api/rest-api.md`

Important regression checks:

- budgets and sales still return the same results without `branchId`
- calls keep current extension-based filtering behavior when `branchId` is absent
- whatsapp keeps current `chatId` behavior when `branchId` is absent
- branch-filtered calls comparison uses the same branch on both call and budget sides
- branch-filtered WhatsApp metrics exclude records without resolvable employee mapping

## Success Criteria

This work is successful when:

- all KPI families accept optional `branchId` where approved
- requests without `branchId` behave exactly as before
- budgets and sales filter directly by fact branch
- calls and whatsapp filter by employee-derived branch attribution
- unmatched or non-attributable calls and WhatsApp records disappear in filtered mode
- the frontend can opt into branch filtering by sending only `branchId`
- the REST API documentation clearly explains the new backend contract
