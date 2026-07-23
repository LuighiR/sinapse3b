# Calls KPI — Lost Without Employee Includes Queues

Date: 2026-07-23
Project: Sinapse backend calls KPI
Status: Approved in conversation

## Goal

Make `lostWithoutEmployee` (summary card and drilldown with `withoutEmployee=true`) include inbound lost calls that only reached a **queue** (3-digit destination/ramal), even when that number matches an Employee `extensionNumber`.

## Relationship To Existing Design

Extends:

- `docs/superpowers/specs/2026-03-25-calls-kpi-design.md`
- queue classification already documented in `docs/kpi-catalog.md` and `docs/api/rest-api.md`

Does not replace those documents. Changes only the **without-employee** matching rule for calls.

## Problem

Observed on `/kpis/calls/summary` and `/kpis/calls/drilldown`:

- Inbound lost calls with 3-digit destinations **appear** under `direction=inbound&outcome=UNANSWERED`
- The same calls **disappear** under `withoutEmployee=true`
- Summary `lostWithoutEmployee.count` stays artificially low (e.g. 17)

Root cause: `buildWithoutEmployeeFilter` excludes any call whose `agentExtensionNumber` / `agentResolutionKey` uniquely matches an Employee `extensionNumber`. Queue destinations are often 3 digits and collide with registered employee extensions, so queue losses are treated as “with attendant” even though no human answered.

## Product Intent

- Fila (URA/queue) ≠ atendente humano
- Card “não atendidas sem atendente” must include queue losses
- Drilldown opened from that card must list the same set
- Matching Employee by `extensionUuid` still means “with attendant”
- Registering a queue number as Employee must **not** remove those calls from the without-employee card (Employee row may still help ranking labels later; out of scope here)

## Approved Approach

**Approach 1:** In the without-employee criterion only, treat queue-shaped lost calls as always without employee, ignoring Employee match by `extensionNumber`.

Rejected alternatives:

- Match by extension number only for 4+ digit ramais: broader change that would also stop excluding real 3-digit **agent** rings that only match via `extensionNumber` and have no usable `extensionUuid` path in the same way; the approved rule instead keeps uuid exclusion and only skips 3-digit numbers from the **extensionNumber** exclusion arms
- Persist `is_queue` on `call_facts` (migrate/backfill for the same filter effect)

## Business Rule

A call is **queue without attendant** when all of:

1. `direction = inbound` (or equivalent inbound scope already used by the endpoint)
2. `is_lost = true`
3. `extensionUuid` is null/empty
4. Resolved ramal (`destinationNumber` or `agentExtensionNumber`, same 3-digit rule already used in normalization) matches `/^\d{3}$/`

Such calls **always** satisfy `withoutEmployee`, even if an Employee has the same `extensionNumber`.

Employee match via **`extensionUuid`** still excludes the call from without-employee (real agent ring).

Existing without-employee behavior for non-queue lost calls is unchanged:

- unique Employee match by uuid or by non-queue extension number → with attendant
- no unique match → without attendant

## Scope

In scope:

- `buildWithoutEmployeeFilter` in `prisma-call-kpi.repository.ts` (shared by summary count and drilldown)
- Unit tests for the repository filter/count behavior
- Short documentation notes in `docs/api/rest-api.md` and `docs/kpi-catalog.md`

Out of scope:

- Schema / Prisma migration
- Changes to call normalization (`is_received` / `is_lost` / queue-only answered)
- KPI refresh / snapshot materialization keys
- Response JSON shape of summary or drilldown
- Ranking, hourly, or other call endpoints
- Frontend UI work
- Treating registered queue Employees as a separate entity type

## Implementation Sketch

Update `buildWithoutEmployeeFilter` so Employee exclusion by extension **number** ignores 3-digit codes, while exclusion by `extensionUuid` stays as today.

**Recommended concrete rule for the helper (what the plan must implement):**

- Do **not** express `/^\d{3}$/` inside the Prisma `where` for call rows
- `uniqueExtensionUuids` → still used in `NOT` / exclusion (unchanged)
- `uniqueExtensionNumbers` → when building exclusion filters on `agentExtensionNumber` / `agentResolutionKey`, **skip** numbers that match `/^\d{3}$/`
- Do not change exclusion by `extensionUuid`
- Normalization already sets `agentExtensionNumber` (and often `agentResolutionKey`) from the destination for these lost/queue rows, so omitting 3-digit numbers from the Employee exclusion list is enough

This makes: lost call to destination `101` with Employee `extensionNumber=101` and no uuid → **included** in without-employee. Lost call with Employee uuid → **excluded**. Lost call to `1041` matching Employee `1041` → **excluded**.

No API contract change. After deploy, `lostWithoutEmployee.count` and drilldown totals increase for tenants with queue traffic.

## Testing

Repository unit tests:

| Case | Expected in `withoutEmployee` |
| --- | --- |
| Lost, destination/agent `101`, no uuid, Employee with `extensionNumber=101` | Included |
| Lost, `1041`, no uuid, Employee with `1041` | Excluded |
| Lost, `101`, with Employee `extensionUuid` | Excluded |
| Lost, `999`, no matching Employee | Included |
| Lost, agent `101`, Employee A has `extensionNumber=101`, call has `extensionUuid` of Employee B | Excluded (uuid wins) |

Update existing `countLostWithoutEmployee` / drilldown withoutEmployee expectations if they assumed 3-digit numbers in the exclusion list.

## Documentation

Add one note under calls KPI without-employee / `lostWithoutEmployee`:

- inbound lost calls with empty `extensionUuid` and exactly 3-digit ramal count as without attendant even when an Employee shares that `extensionNumber`

## Success Criteria

- Summary `lostWithoutEmployee` includes queue losses that currently only appear under unanswered drilldown
- Drilldown `withoutEmployee=true` lists the same population
- Non-queue employee matching behavior for 4+ digit (and uuid) ramais remains correct
- No migration or refresh required for the fix to take effect on existing `call_facts`
