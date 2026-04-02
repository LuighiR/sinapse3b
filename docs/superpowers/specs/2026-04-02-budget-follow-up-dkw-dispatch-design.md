# Budget Follow-Up DKW Dispatch Design

Date: 2026-04-02
Project: Sinapse backend budget follow-up webhook dispatch
Status: Approved in conversation

## Goal

Add a backend-only dispatch flow that sends open budget follow-ups older than 24 hours to the DKW webhook without reprocessing already-sent rows.

## Relationship To Existing Design

This spec extends:

- `docs/superpowers/specs/2026-03-29-budget-follow-up-daily-drilldown-design.md`
- `docs/superpowers/specs/2026-03-31-budget-cancellation-follow-up-adjustment-design.md`

It reuses the already approved follow-up classification contract implemented for:

- `GET /kpis/budgets/follow-up/summary`
- `GET /kpis/budgets/follow-up/daily`
- `GET /kpis/budgets/follow-up/drilldown`

## Product Intent

The user needs a manual backend trigger that:

- finds budgets that are still open after 24 hours
- sends them to an external DKW webhook
- avoids resending budgets that have already been sent
- is safe to call repeatedly and later from an hourly cron job

This slice is backend-only. Cron scheduling is explicitly out of scope for now and can be added later by calling the same endpoint.

## Scope

This spec covers:

- adding one new authenticated endpoint to dispatch DKW follow-up leads
- reusing the canonical follow-up classification rules already approved in the KPI module
- reading operational fields from `raw.ferraco_budgets`
- marking successful sends in `raw.ferraco_budgets.sent_dkw_at`
- stopping processing after three consecutive webhook failures
- logging execution progress with `console.log`
- adding automated coverage for parser, service, repository wiring, and controller behavior

This spec does not cover:

- cron scheduling
- changing existing follow-up query response shapes
- moving operational dispatch state into `core.budget_facts`
- retries beyond a single sequential pass
- asynchronous queue processing

## Approved Endpoint

### `POST /kpis/budgets/follow-up/dkw-dispatch`

Purpose:

- dispatch budgets classified as `after24h` and `open` to the DKW webhook

Approved inputs:

- `from` required
- `to` required
- `referenceAt` required
- `sellerId` optional
- `branchId` optional
- `orderType` optional

Input transport:

- use query string parameters to match the established KPI controller pattern

Approved response shape:

```json
{
  "period": {
    "from": "2026-04-01",
    "to": "2026-04-02",
    "key": "2026-04-01_2026-04-02"
  },
  "referenceAt": "2026-04-02T10:00:00-03:00",
  "status": "completed"
}
```

Approved terminal statuses:

- `completed`
- `aborted_after_consecutive_errors`

The HTTP response should stay intentionally compact. Detailed execution counts can stay in logs.

## Eligibility Rules

The dispatch flow must reuse the same canonical follow-up classifier already used by the follow-up summary, daily, and drilldown endpoints.

Eligible rows are:

- budgets selected within the requested opening period
- budgets that classify as `followUpWindow = after24h`
- budgets that classify as `followUpStatus = open`

Additional dispatch constraints:

- the row must come from `raw.ferraco_budgets`
- `raw.ferraco_budgets.sent_dkw_at` must be `NULL`

Important rule:

- the dispatch endpoint must not reimplement follow-up status semantics separately from the approved classifier

## Data Source Strategy

### Follow-up classification source

The system must continue to classify budgets from `core.budget_facts`, because that table already holds the normalized data and approved follow-up behavior.

### Operational send state source

The system must use `raw.ferraco_budgets` as the source of truth for:

- `email`
- `cell_phone`
- `phone`
- `sent_dkw_at`

Reasoning:

- `sent_dkw_at` is operational integration state, not analytics state
- `core.budget_facts` is refreshed from `raw`, so storing dispatch state only in `core` would make the design more fragile

### Join rule

The dispatch flow must join:

- `core.budget_facts.source_table = 'raw.ferraco_budgets'`
- `core.budget_facts.source_record_id = raw.ferraco_budgets.id`

The join result should provide both the normalized follow-up context from `core` and the operational fields from `raw`.

## Webhook Contract

Target:

- `POST https://atende-api.corz.com.br/webhook/leads/cfebb0a7-4143-4fcc-8fca-575b6a631aea`

Approved outgoing payload:

```json
{
  "name": "Joao Silva",
  "email": "joao@gmail.com",
  "phone": "5551999999999",
  "valor_orcamento": "250.00",
  "codigo_dav": "9001",
  "vendedor": "Maria",
  "data_hora_abertura": "2026-04-01T08:30:00",
  "mensagem": "Sem telefone registrado"
}
```

Field mapping:

- `name` <- `raw.ferraco_budgets.customer_name`
- `email` <- `raw.ferraco_budgets.email`
- `phone` <- `raw.ferraco_budgets.cell_phone`, fallback `raw.ferraco_budgets.phone`, fallback `"Sem registro"`
- `valor_orcamento` <- raw budget value
- `codigo_dav` <- raw `dav_id`
- `vendedor` <- raw `seller_name`
- `data_hora_abertura` <- combination of raw `opening_date + opening_time`

Conditional additional field:

- when both `cell_phone` and `phone` are absent or blank, include `mensagem = "Sem telefone registrado"`

The dispatch should still attempt the webhook even when the phone fallback reaches `"Sem registro"`.

## Dispatch State Update

After each successful webhook send:

- update `raw.ferraco_budgets.sent_dkw_at = NOW()`

If the webhook call fails:

- do not update `sent_dkw_at`
- leave the row eligible for a future retry

This update must happen only after the webhook call succeeds.

## Failure Handling

Processing is sequential and item-by-item.

Approved behavior:

- a single failed webhook send does not stop the whole run
- the process continues to the next eligible row
- the process aborts only when there are three consecutive webhook failures

Consecutive failure rules:

- any successful send resets the consecutive failure counter back to zero
- rows skipped because `sent_dkw_at` is already set do not count as failures

Approved terminal outcome when the threshold is hit:

- stop processing immediately
- return `status = "aborted_after_consecutive_errors"`

## Logging

Use `console.log` for operational validation.

The implementation should log at least:

- start of execution with period and filters
- each sent row
- each skipped row because it was already sent
- each failed row
- when the three-consecutive-error threshold aborts the run
- end of execution

The HTTP response does not need to expose the full execution summary.

## Recommended Code Shape

### Presentation layer

Add a dedicated parser for the new dispatch endpoint that:

- validates `from` and `to` with the same KPI period rules
- validates `referenceAt` with the same approved follow-up semantics
- parses optional `sellerId`, `branchId`, and `orderType`

Add one controller route:

- `POST /kpis/budgets/follow-up/dkw-dispatch`

The controller should only:

- parse inputs
- inject `clientId`
- call the application service

### Application layer

Add a dedicated service method for the dispatch flow instead of overloading an existing query endpoint.

Recommended responsibilities:

- fetch eligible normalized budget facts
- join the related raw budget fields needed for payload and send-state filtering
- classify each candidate with the shared follow-up classifier
- build the webhook payload
- send sequentially
- update `sent_dkw_at` on success
- stop after three consecutive errors

### Infrastructure layer

Add repository support for:

- listing dispatch candidates with both `core` and `raw` fields
- marking raw rows as sent

Add a small outbound webhook client abstraction so the service can be tested without making network calls.

## Testing Strategy

Required coverage:

- parser tests for the new dispatch query parser
- service tests proving:
  - only `after24h + open` rows are sent
  - rows with `sent_dkw_at` already filled are skipped
  - phone fallback order is respected
  - missing phone adds `mensagem = "Sem telefone registrado"` and still sends
  - successful sends update `sent_dkw_at`
  - a failed send does not update `sent_dkw_at`
  - three consecutive failures abort the run
  - a success resets the consecutive failure counter
- controller or e2e tests proving:
  - the route is tenant-scoped
  - parsed filters reach the service correctly

## Documentation Updates

Update `docs/api/rest-api.md` to include:

- `POST /kpis/budgets/follow-up/dkw-dispatch`

The REST documentation must explicitly say:

- the endpoint reuses the existing follow-up classification semantics
- only `after24h + open` budgets are dispatched
- send state is tracked in `raw.ferraco_budgets.sent_dkw_at`
- the webhook still receives rows without phone numbers using the approved fallback payload
