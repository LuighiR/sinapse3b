# Employee ERP Users Design

Date: 2026-07-09
Project: Sinapse backend employee ↔ ERP user normalization
Status: Approved in conversation

## Goal

Normalizar a relação entre pessoa (`Employee`) e usuários do ERP, permitindo que um employee tenha vários IDs de ERP por filial atendida, para filtrar vendas/orçamentos pelo `sellerId` correto.

## Problem

Hoje `core.employees` tem um único `erp_id` por pessoa. Na operação real, a mesma pessoa (ex.: Richard) possui vários usuários no ERP — um por cidade/filial que atende. Quem atende aquela cidade usa aquele usuário. Com um único `erp_id`, não dá para modelar nem filtrar corretamente por usuário ERP × filial.

## Product Intent

- `Employee.branchId` = filial onde a pessoa **reside**
- Vínculos ERP = filiais que a pessoa **atende** (podem ser várias, inclusive a de residência)
- Um `erpId` pertence a no máximo uma pessoa no mesmo cliente
- Na mesma filial, um employee pode ter mais de um usuário ERP
- Filtros de budgets/sales por `sellerId` continuam usando o ID do ERP; só muda a tabela de origem

## Scope

This spec covers:

- criar tabela `core.employee_erp_users`
- migrar `employees.erp_id` para a nova tabela e remover a coluna
- atualizar `GET /companies/current/employees` para devolver `erpUsers[]` e remover `erpId` do topo
- criar endpoints de vínculo (listar / criar / remover) — sem `PATCH`/update de vínculo
- atualizar lookup de branch na normalização (`EmployeeBranchLookupReader`, CTEs em budget/sale normalization)
- atualizar match DKW que resolve employee via `erp_id` (`prisma-budget-follow-up-dkw-dispatch.repository.ts`)
- atualizar documentação REST (`sellerId` → `employee_erp_users.erp_id`)

This spec does not cover:

- CRUD completo de employee (create/update/delete da pessoa)
- `PATCH`/update de um vínculo ERP existente (remover e recriar)
- mudar a semântica do filtro `branchId` em employees para “atende esta filial”
- UI/frontend
- alterar o significado de `sellerId` nas facts já gravadas (`budget_facts` / `sale_facts`)

## Approved Data Model

### `Employee` (pessoa)

Mantém:

- `name`, `extensionNumber`, `extensionUuid`, `chatId`, `dkwWebhook`, `isNonCommercial`
- `branchId` — filial de residência

Remove:

- `erpId`

### Nova tabela `employee_erp_users`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `id` | Int PK autoincrement | identificador do vínculo |
| `employeeId` | Int FK → `employees` | pessoa |
| `clientId` | String FK → `sinapse_clients` | tenant (desnormalizado para unique) |
| `erpId` | BigInt | usuário do ERP (`sellerId` em budgets/sales) |
| `branchId` | Int FK → `branches` | filial que esse usuário atende |
| `createdAt` | DateTime | auditoria |
| `updatedAt` | DateTime | auditoria |

`clientId` é desnormalizado a partir da branch do vínculo (e deve coincidir com o client do employee via `employees.branch`). Serve para impor unicidade de `erpId` **por cliente** no banco — IDs ERP de clientes diferentes podem coincidir.

Prisma (rascunho):

```prisma
model EmployeeErpUser {
  id         Int           @id @default(autoincrement())
  employeeId Int           @map("employee_id")
  clientId   String        @map("client_id")
  erpId      BigInt        @map("erp_id")
  branchId   Int           @map("branch_id")
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")
  employee   Employee      @relation(fields: [employeeId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  client     SinapseClient @relation(fields: [clientId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  branch     Branch        @relation(fields: [branchId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@unique([clientId, erpId], map: "employee_erp_users_client_erp_id_key")
  @@index([employeeId], map: "employee_erp_users_employee_id_idx")
  @@index([branchId], map: "employee_erp_users_branch_id_idx")
  @@map("employee_erp_users")
  @@schema("core")
}
```

### Constraints

1. **`erpId` único por cliente** — `@@unique([clientId, erpId])`. Um ID do ERP só pode pertencer a uma pessoa no mesmo `SinapseClient`. Clientes diferentes podem reutilizar o mesmo número. O service também valida antes do insert e responde `409` em conflito (incluindo se o mesmo employee já tiver aquele `erpId`).

2. **Vários vínculos na mesma filial** — permitido (sem unique em `(employee_id, branch_id)`).

3. **FK**:
   - `employeeId` → `employees.id` com `onDelete: Cascade`
   - `branchId` → `branches.id` com `onDelete: Restrict`
   - `clientId` → `sinapse_clients.id` com `onDelete: Restrict`

4. **Consistência de tenant no POST** — `branch.clientId` e `employee.branch.clientId` devem ser iguais ao `clientId` autenticado; o vínculo grava esse `clientId`.

### Semântica de branch

| Campo | Significado |
|-------|-------------|
| `employees.branch_id` | Onde a pessoa reside |
| `employee_erp_users.branch_id` | Filial que aquele usuário ERP atende |

Podem coincidir (primeiro vínculo migrado) ou diferir (atendimento em outra cidade).

## Migration Plan

1. Criar `core.employee_erp_users` com FKs, índices e `@@unique([client_id, erp_id])`
2. Detectar duplicatas **antes** do backfill: no mesmo `client_id` (via `employees → branches`), se o mesmo `erp_id` aparecer em mais de um employee, a migration **falha** com lista dos `erp_id` / `employee_id` conflitantes — não há desempate automático; dados devem ser corrigidos manualmente
3. Backfill: para cada row em `core.employees` sem conflito, inserir um vínculo com `erp_id`, `branch_id` (residência) e `client_id` da branch do employee
4. Atualizar código de lookup/normalização/API/DKW para ler a nova tabela
5. Dropar `core.employees.erp_id`
6. Atualizar docs

A migration de dados deve ser segura para staging/prod: ou completa o backfill limpo, ou aborta com diagnóstico — nunca cria vínculos que violem a unique.

## API Contract

### `GET /companies/current/employees`

Breaking change no payload:

- remove `erpId` do objeto employee
- adiciona `erpUsers: Array<{ id: number, erpId: number, branchId: number }>`

Filtro query `branchId` continua filtrando pela **filial de residência** (`employees.branch_id`).

Exemplo:

```json
{
  "id": 12,
  "name": "Richard",
  "branchId": 1,
  "extensionNumber": "1001",
  "extensionUuid": "...",
  "chatId": "richard@empresa.com",
  "isNonCommercial": false,
  "erpUsers": [
    { "id": 1, "erpId": 111, "branchId": 1 },
    { "id": 2, "erpId": 222, "branchId": 3 }
  ]
}
```

### Endpoints de vínculo

Base: `/companies/current/employees/:employeeId/erp-users`

| Método | Path | Ação |
|--------|------|------|
| `GET` | `.../erp-users` | lista vínculos do employee |
| `POST` | `.../erp-users` | cria vínculo `{ erpId, branchId }` |
| `DELETE` | `.../erp-users/:erpUserId` | remove vínculo |

Escopo de tenant: employee e branch devem pertencer ao `clientId` autenticado.

### Erros

| Situação | Status |
|----------|--------|
| Employee inexistente / outro tenant | `404` |
| Branch inexistente / outro tenant | `400` |
| `erpId` já ligado a qualquer employee do mesmo cliente (incluindo o próprio) | `409` |
| Body inválido | `400` |
| DELETE de vínculo inexistente / outro employee | `404` |

## Normalization And KPI Impact

### Branch lookup (budgets/sales normalization)

Hoje o lookup agrupa `employees.erp_id` → branch (só resolve branch se houver exatamente um employee com aquele `erp_id`).

Passa a:

- chave: `employee_erp_users.erp_id`
- branch: `employee_erp_users.branch_id` (e nome via join em `branches`)
- como `erpId` é único por cliente, o lookup fica 1:1 — sempre resolve branch quando o vínculo existe

### Filtro `sellerId`

Continua sendo o número do usuário ERP. Origem documentada muda de `core.employees.erp_id` para `core.employee_erp_users.erp_id`.

Facts já persistidas (`budget_facts.seller_id`, `sale_facts.seller_id`) não mudam de valor.

### Outros consumidores

Qualquer código que leia `employees.erpId` (services, fixtures de teste, docs) deve ser atualizado na implementação.

### DKW dispatch match

Hoje o repositório casa `employees.erp_id = fact.seller_id AND employees.branch_id = fact.branch_id`.

Regra nova (obrigatória):

- casar `employee_erp_users.erp_id = fact.seller_id`
- **e** `employee_erp_users.branch_id = fact.branch_id` (filial **atendida** pelo vínculo, não a residência do employee)

Usar residência quebraria o caso multi-filial que este feature resolve. O webhook continua vindo do `Employee` encontrado via esse vínculo (`employees.dkw_webhook`).

### Resposta de `GET .../erp-users`

Mesmo shape de item que em `erpUsers[]` no GET employees:

```json
[{ "id": 1, "erpId": 111, "branchId": 1 }]
```

## Testing

- GET employees: sem `erpId` no topo; com `erpUsers[]`
- POST vínculo: sucesso; conflito `409` de `erpId` duplicado; branch/employee fora do tenant
- DELETE vínculo: sucesso e `404`
- Lookup de normalização usa `employee_erp_users`
- Regressão: filtro `sellerId` em budgets/sales com o mesmo ID ERP

## Out Of Scope Follow-Ups

- Filtro em employees por “atende branch X” via vínculos
- CRUD da pessoa employee via API
- Expor `dkwWebhook` na API pública (já fora de escopo em spec anterior)
