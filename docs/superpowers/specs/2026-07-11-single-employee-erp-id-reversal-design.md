# Single Employee ERP Id Reversal Design

Date: 2026-07-11
Project: Sinapse backend — revert multi ERP-user links; one sellerId per person across branches
Status: Approved in conversation

## Goal

Corrigir o modelo: cada pessoa tem **um** `erpId` (seller do ERP). O mesmo `seller_id` aparece em várias filiais nos raw budgets. Remover `employee_erp_users`, devolver `erpId` para `Employee`, e resolver `branch_id` das facts pelo código de filial do ERP (`raw.branch` → `branches.erp_id`), não pelo employee.

## Problem

O design anterior assumia vários usuários ERP por pessoa (um por cidade). Nos dados reais (ex.: Shaiane `seller_id=42754`), o **mesmo** ID gera orçamentos em branches raw `1`, `3` e `5`. Com o vínculo antigo, a normalização jogava todos os facts dela para a filial de residência (Pelotas), zerando as outras colunas da grade.

## Product Intent

- Um employee = um `erpId`
- Filtro de pessoa: `sellerId` = `employees.erp_id`
- Filtro de loja: `branchId` = filial Sinapse
- Front lista **todas** as filiais; se não houver dados daquela pessoa na loja, mostra **0**
- Não há tabela de “filiais atendidas”; a presença de dados vem dos facts

## Scope

This spec covers:

- Migration: restaurar `core.employees.erp_id`, backfill a partir de `employee_erp_users`, dropar `employee_erp_users`
- Reverter Prisma schema / relations
- Reverter API employees: `erpId` no topo; remover endpoints `.../erp-users`
- Normalização budgets/sales: branch via `branches.erp_id` ↔ `raw.branch` (não via employee)
- Lookup reader / DKW: voltar a `employees.erp_id`; DKW casa seller sem exigir branch de residência
- Atualizar testes, fixtures, docs (`rest-api.md`)
- Re-normalizar facts existentes (ou documentar comando de refresh) para corrigir `branch_id` errado

This spec does not cover:

- UI/frontend (só contrato)
- Mudar WhatsApp `branchId` ignore (já feito; permanece)
- CRUD completo de employee

## Data Model

### `Employee`

Volta a ter:

- `erpId BigInt @map("erp_id")`

Remove relation `erpUsers`.

### Drop

- model / table `core.employee_erp_users`
- endpoints e service `EmployeeErpUsersService`

### Branch mapping (normalization)

| Raw `ferraco_budgets.branch` | `branches.erp_id` | Sinapse branch (exemplo Ferraco) |
|------------------------------|-------------------|----------------------------------|
| `1` | `1` | Pelotas |
| `5` | `5` | Santa Maria |
| `3` | `3` | Rio Grande |

Join:

```sql
LEFT JOIN core.branches AS b
  ON b.client_id = budget.client_id
 AND b.erp_id = NULLIF(btrim(budget.branch), '')::bigint
```

(usar cast seguro; branch inválido → `branch_id` null, `branch_name` fallback no texto raw)

Seller continua vindo de `budget.seller_id` / `sale.seller_id` sem depender do employee para achar a loja.

## Migration Plan

1. Add `core.employees.erp_id BIGINT` nullable temporarily
2. Backfill: para cada employee, se tiver exatamente um `employee_erp_users`, copiar `erp_id`; se tiver mais de um, **falhar** com lista (não escolher automaticamente)
3. `ALTER COLUMN erp_id SET NOT NULL`
4. Drop `core.employee_erp_users` (FKs, indexes, table)
5. Deploy código que não referencia a tabela
6. Rodar refresh/normalize de budgets (e sales) para reescrever `branch_id`/`branch_name` corretos

## API Contract

### `GET /companies/current/employees`

Payload volta a:

```json
{
  "id": 2,
  "erpId": 42754,
  "name": "Shaiane Rocha da Silva",
  "branchId": 2,
  "extensionNumber": "...",
  "extensionUuid": "...",
  "chatId": "...",
  "isNonCommercial": false
}
```

- Remove `erpUsers[]`
- `branchId` continua = filial de residência (ramal/chat); **não** limita em quais lojas o `sellerId` pode filtrar

### Remover

- `GET/POST /companies/current/employees/:employeeId/erp-users`
- `DELETE /companies/current/employees/:employeeId/erp-users/:erpUserId`

### KPI filters (inalterados semanticamente, origem documentada)

- Budgets/sales: `sellerId` = `employees.erp_id`; `branchId` = filial Sinapse
- Mesmo `sellerId` pode ter facts em várias lojas
- Front: para cada loja, chamar com `sellerId` + `branchId`; sem linhas → UI mostra 0

### DKW

Match webhook:

```sql
FROM core.employees e
WHERE e.erp_id = fact.seller_id
ORDER BY e.id
LIMIT 1
```

Não exigir `e.branch_id = fact.branch_id` (pessoa única com vendas multi-loja).

## Docs

Atualizar `docs/api/rest-api.md`:

- Remover guia multi-`erpUsers`
- Documentar `erpId` no employee
- Explicar filtro multi-loja: mesmo `sellerId` + `branchId` por coluna; vazio = 0
- `sellerId` origem = `core.employees.erp_id`

## Testing

- Schema: Employee tem `erpId`; sem `EmployeeErpUser`
- GET employees com `erpId`, sem `erpUsers`
- Endpoints erp-users → 404
- Normalization SQL junta `branches.erp_id` / `budget.branch`
- DKW SQL usa `employees.erp_id` sem match de branch de residência
- Docs atualizados

## Out Of Scope Follow-Ups

- Job automático de re-normalize pós-migration (pode ser refresh manual via `POST /kpis/budgets/refresh` e sales)
