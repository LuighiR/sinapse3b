# Sinapse 3 REST API

Base URL de desenvolvimento:

```text
http://localhost:3000
```

## Authentication

### Session Bootstrap

Frontends externos agora podem abrir sessao diretamente pelo backend Nest:

- `POST /auth/login`
- `POST /auth/refresh`

O fluxo recomendado e:

1. enviar `email` e `password` para `/auth/login`
2. guardar `accessToken` e `refreshToken`
3. usar `Authorization: Bearer <accessToken>` nas rotas protegidas
4. quando o access token expirar, enviar o `refreshToken` para `/auth/refresh`

### Bearer Token

As rotas protegidas esperam:

```http
Authorization: Bearer <access-token>
```

### Tenant Scope

As rotas multi-tenant que dependem do contexto da empresa também esperam:

```http
X-Tenant-Id: <tenant-id>
```

O backend resolve o `sinapse_client` internamente a partir de:

`user -> membership -> tenant -> tenant.backend_client_id -> sinapse_client`

O frontend nao precisa enviar `clientId` nas APIs de KPI.

### CORS em desenvolvimento

Por padrao, em desenvolvimento e teste, a API aceita a origem:

```text
http://localhost:3001
```

Para outras origens, configure `CORS_ALLOWED_ORIGINS` no backend com uma lista separada por virgula.

## Conventions

- Datas usam `YYYY-MM-DD`
- Periodos usam `from` e `to`
- Calendario de KPI segue `America/Sao_Paulo`
- Se `from > to`, a API responde `400 Bad Request`
- Campos de canal sem valor retornam `Nao identificado`

## Standard Errors

### `400 Bad Request`

Exemplo:

```json
{
  "statusCode": 400,
  "message": "Invalid budget summary query params"
}
```

### `401 Unauthorized`

Exemplo:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### `403 Forbidden`

Exemplo:

```json
{
  "statusCode": 403,
  "message": "Inactive tenant"
}
```

## Health

### `GET /health`

Descricao:
healthcheck simples da API.

Auth:
nenhuma.

Response `200`:

```json
{
  "status": "ok"
}
```

## Auth

### `POST /auth/login`

Descricao:
autentica o usuario com email e senha e retorna um par de tokens em JSON.

Auth:
nenhuma.

Request body:

```json
{
  "email": "ana@example.com",
  "password": "secret-123"
}
```

Response `200`:

```json
{
  "tokenType": "Bearer",
  "accessToken": "<access-token>",
  "refreshToken": "<refresh-token>",
  "expiresInSeconds": 3600,
  "user": {
    "id": "u1",
    "email": "ana@example.com",
    "name": "Ana"
  },
  "tenants": [
    {
      "id": "tenant-ferracosul-kpi-dev",
      "name": "Ferracosul",
      "slug": "ferracosul-kpi-dev",
      "role": "ADMIN",
      "backendClientId": "ferracosul"
    }
  ]
}
```

Response `401`:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

### `POST /auth/refresh`

Descricao:
renova a sessao a partir de um refresh token valido e retorna um novo par de tokens.

Auth:
nenhuma.

Request body:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Response `200`:

```json
{
  "tokenType": "Bearer",
  "accessToken": "<new-access-token>",
  "refreshToken": "<new-refresh-token>",
  "expiresInSeconds": 3600
}
```

Response `401`:

```json
{
  "statusCode": 401,
  "message": "Invalid refresh token"
}
```

### `GET /auth/context`

Descricao:
retorna o contexto autenticado e o escopo multi-tenant resolvido.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
{
  "user": {
    "id": "user-1",
    "email": "user@example.com",
    "name": "User One"
  },
  "tenant": {
    "id": "tenant-ferracosul-kpi-dev",
    "name": "Ferracosul",
    "slug": "ferracosul-kpi-dev"
  },
  "client": {
    "id": "ferracosul",
    "name": "Ferracosul"
  },
  "membership": {
    "role": "ADMIN"
  }
}
```

## Me

### `GET /me`

Descricao:
retorna o usuario autenticado.

Headers:

```http
Authorization: Bearer <jwt>
```

Response `200`:

```json
{
  "id": "user-1",
  "email": "user@example.com",
  "name": "User One"
}
```

### `GET /me/tenants`

Descricao:
lista os tenants ativos do usuario.

Headers:

```http
Authorization: Bearer <jwt>
```

Response `200`:

```json
[
  {
    "id": "tenant-ferracosul-kpi-dev",
    "name": "Ferracosul",
    "slug": "ferracosul-kpi-dev",
    "role": "ADMIN",
    "backendClientId": "ferracosul"
  }
]
```

## Tenant Users

### Access Rules

Administracao de usuarios por tenant segue estas regras:

- exige `Authorization: Bearer <jwt>`
- exige `X-Tenant-Id: <tenant-id>`
- usa sempre o tenant ativo do header
- permite acesso apenas para memberships `OWNER` e `ADMIN`

### `GET /tenant-users`

Descricao:
lista os usuarios vinculados ao tenant ativo, incluindo status do usuario e status da membership naquele tenant.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
[
  {
    "id": "u-admin",
    "email": "admin@example.com",
    "name": "Admin",
    "isActive": true,
    "role": "ADMIN",
    "membershipIsActive": true
  },
  {
    "id": "u-viewer",
    "email": "viewer@example.com",
    "name": "Viewer",
    "isActive": true,
    "role": "VIEWER",
    "membershipIsActive": true
  }
]
```

Response `403`:

```json
{
  "statusCode": 403,
  "message": "Tenant user administration requires owner or admin membership"
}
```

### `POST /tenant-users`

Descricao:
cria um novo usuario no tenant ativo ou reaproveita um usuario existente pelo email, atualizando senha e reativando a membership do tenant atual.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Request body:

```json
{
  "email": "new.user@example.com",
  "name": "New User",
  "password": "secret-123",
  "role": "VIEWER"
}
```

Campos:

- `email` required
- `password` required
- `role` required: `OWNER`, `ADMIN`, `MANAGER`, `VIEWER`
- `name` optional
- `isActive` optional, default `true`

Response `201`:

```json
{
  "id": "9b2f7c7c-fb55-4f4e-88e8-d1b9867f1111",
  "email": "new.user@example.com",
  "name": "New User",
  "isActive": true,
  "role": "VIEWER",
  "membershipIsActive": true
}
```

Response `400`:

```json
{
  "statusCode": 400,
  "message": "Invalid tenant user payload"
}
```

### `PATCH /tenant-users/:userId`

Descricao:
atualiza o usuario e a membership do tenant ativo para o `userId` informado.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Path Params:

- `userId` required

Request body:

```json
{
  "name": "Viewer Updated",
  "password": "after-123",
  "role": "MANAGER",
  "isActive": true,
  "membershipIsActive": false
}
```

Todos os campos do body sao opcionais, mas pelo menos um deles precisa ser enviado:

- `name`
- `password`
- `role`
- `isActive`
- `membershipIsActive`

Response `200`:

```json
{
  "id": "u-viewer",
  "email": "viewer@example.com",
  "name": "Viewer Updated",
  "isActive": true,
  "role": "MANAGER",
  "membershipIsActive": false
}
```

Response `404`:

```json
{
  "statusCode": 404,
  "message": "Tenant user not found"
}
```

## Companies

### `GET /companies/current`

Descricao:
retorna a empresa atual resolvida pelo tenant ativo.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
{
  "id": "ferracosul",
  "name": "Ferracosul",
  "slug": "ferracosul"
}
```

### `GET /companies/current/branches`

Descricao:
lista as filiais da empresa atual.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Matriz",
    "clientId": "ferracosul"
  }
]
```

Notas para o frontend:

- usar `id` como `branchId` nas rotas de KPI
- nao usar `domainUuid` do client para filtrar chamadas
- o Domain ID da telefonia fica no backend em `core.branches.telephony_domain_uuid` e nao precisa ser enviado pelo frontend

### `GET /companies/current/employees`

Descricao:
lista funcionarios da empresa atual.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `branchId` optional, integer — filtra pela filial de **residencia** do employee (`employees.branch_id`)
- `search` optional, text

Exemplo:

```text
GET /companies/current/employees?branchId=1&search=fabiano
```

Response `200`:

```json
[
  {
    "id": 12,
    "name": "Fabiano Pereira da Silva",
    "branchId": 1,
    "extensionNumber": "101",
    "extensionUuid": "3c5f7f91-6b21-4b4d-a7a0-2d5f8e7a1234",
    "chatId": "fabiano@empresa.com",
    "isNonCommercial": false,
    "erpUsers": [
      { "id": 1, "erpId": 35747, "branchId": 1 },
      { "id": 2, "erpId": 35748, "branchId": 3 }
    ]
  }
]
```

Notas:

- `branchId` no employee e a filial onde a pessoa **reside**
- `erpUsers[].branchId` e a filial que aquele usuario ERP **atende**
- `erpUsers[].erpId` e o identificador usado como `sellerId` nas rotas de `budgets` e `sales`

#### Guia frontend: filtro por pessoa nas 3+ lojas

A tela de vendas/orcamentos/mensagens/ligacoes por loja **nao** filtra por `employee.id`. Filtra por `sellerId` = usuario ERP daquela loja.

Fluxo recomendado:

1. `GET /companies/current/employees` (sem `branchId`, ou com search) para montar o seletor de **pessoa** (Joaozinho, Maria, etc.)
2. Quando o usuario escolhe uma pessoa, use o array `erpUsers` dela
3. Para **cada loja/coluna** (`branchId`), resolva o `sellerId` assim:

```ts
const sellerIdForBranch = employee.erpUsers.find((u) => u.branchId === branchId)?.erpId
```

4. Chame o KPI daquela loja com `branchId` + `sellerId` quando existir vinculo
5. Se **nao** houver vinculo para aquela loja (ex.: Joaozinho nao atende Rio Grande), **nao** envie `sellerId` de outra loja — mostre **0** / vazio para aquela coluna

Exemplo — Joaozinho:

```json
{
  "id": 20,
  "name": "Joaozinho",
  "branchId": 1,
  "erpUsers": [
    { "id": 1, "erpId": 111, "branchId": 1 },
    { "id": 2, "erpId": 222, "branchId": 2 }
  ]
}
```

| Loja | `branchId` | `sellerId` a enviar | Resultado esperado |
|------|------------|---------------------|--------------------|
| Pelotas | 1 | `111` | vendas/orcamentos dele em Pelotas |
| Santa Maria | 2 | `222` | vendas/orcamentos dele em Santa Maria |
| Rio Grande | 3 | *(sem vinculo)* | **0** — nao usar `111` nem `222` |

Importante:

- A API de budgets/sales aceita **um** `sellerId` por request (um usuario ERP). Para a grade multi-loja, o front faz **uma chamada por loja** (ou reusa o mesmo periodo com `branchId` + `sellerId` distintos).
- **Nao** use `employee.branchId` (residencia) como filtro de KPI por loja.
- Calls/WhatsApp: `sellerId` **nao** filtra ligacoes; em WhatsApp so entra em `tags/hourly/comparison` no lado de orcamentos abertos. Para ligacoes use ramal (`extensionUuid` / `extensionNumber`); para WhatsApp use `chatId` quando aplicavel.

### `GET /companies/current/employees/:employeeId/erp-users`

Descricao:
lista os vinculos ERP do employee.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
[
  { "id": 1, "erpId": 35747, "branchId": 1 },
  { "id": 2, "erpId": 35748, "branchId": 3 }
]
```

Erros:

- `404` employee inexistente ou de outro tenant
- `400` `employeeId` invalido

### `POST /companies/current/employees/:employeeId/erp-users`

Descricao:
cria um vinculo ERP para o employee.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
Content-Type: application/json
```

Body:

```json
{
  "erpId": 35749,
  "branchId": 3
}
```

Response `201`:

```json
{ "id": 3, "erpId": 35749, "branchId": 3 }
```

Erros:

- `404` employee inexistente ou de outro tenant
- `400` body invalido ou branch fora do tenant
- `409` `erpId` ja ligado a qualquer employee do mesmo cliente

### `DELETE /companies/current/employees/:employeeId/erp-users/:erpUserId`

Descricao:
remove um vinculo ERP do employee.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Response `200`:

```json
{ "ok": true }
```

Erros:

- `404` employee ou vinculo inexistente / fora do escopo
- `400` params invalidos

## Budgets KPI

### Filters

Budgets aceitam:

- `from` required
- `to` required
- `sellerId` optional
- `status` optional: `Cancelado`, `Baixado`, `Pendente`
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

`orderType` vem de `raw.ferraco_budgets.order_type`.

### `POST /kpis/budgets/refresh`

Descricao:
normaliza budgets e recalcula a materializacao do periodo.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `from`
- `to`

Response `200`:

```json
{
  "clientId": "ferracosul",
  "from": "2026-01-01",
  "to": "2026-01-31",
  "calculationRunId": "10",
  "recordsRead": 9233,
  "snapshotsCreated": 8,
  "breakdownsCreated": 62,
  "availabilityEnabled": true
}
```

### `GET /kpis/budgets/summary`

Descricao:
retorna cards consolidados de orcamentos.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "total": {
    "count": 9233,
    "value": "11845044.4842"
  },
  "open": {
    "count": 2759,
    "value": "3210400.0000"
  },
  "won": {
    "count": 6474,
    "value": "8634644.4842"
  },
  "lost": {
    "count": 0,
    "value": "0.0000"
  }
}
```

Exemplo:

```text
GET /kpis/budgets/summary?from=2026-01-01&to=2026-01-31&sellerId=35747&status=Baixado&orderType=Nao%20identificado
```

### `GET /kpis/budgets/daily`

Descricao:
serie diaria de quantidade e valor.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-03",
    "key": "2026-01-01_2026-01-03"
  },
  "series": [
    {
      "date": "2026-01-01",
      "count": 2,
      "value": "150.0000"
    },
    {
      "date": "2026-01-02",
      "count": 0,
      "value": "0.0000"
    }
  ]
}
```

### `GET /kpis/budgets/follow-up/summary`

Descricao:
retorna o resumo de follow-up de orcamentos, separado entre janela `ate 24h` e `pos 24h`.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `from` required: inicio do recorte de aberturas
- `to` required: fim do recorte de aberturas
- `referenceAt` required: data e hora de referencia enviada pelo frontend
- `sellerId` optional
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Regra:

- primeiro a API seleciona somente os orcamentos cuja abertura (`budgetDate` / `budgetDatetime`) caiu entre `from` e `to`
- a classificacao considera o estado do orcamento em `referenceAt`, e nao o estado atual
- se um orcamento fechou depois de `referenceAt`, ele ainda entra como `open` naquela consulta
- `converted` usa a diferenca entre abertura e `closingDate + closing_time`, desde que a conversao ja tenha acontecido ate `referenceAt`
- `lost` usa a diferenca entre abertura e `cancellationDate + cancelationTime`, desde que o cancelamento ja tenha acontecido ate `referenceAt`
- `open` usa a diferenca entre abertura e `referenceAt`
- se `closing_time` nao existir no payload bruto, a conversao cai no fim do dia de `closingDate`
- se `cancelationTime` nao existir ou vier invalido, o cancelamento cai no fim do dia de `cancellationDate`
- `percentage` representa a participacao da quantidade sobre o total geral de orcamentos analisados no follow-up
- `total` no topo representa o total geral do follow-up no recorte analisado
- `within24h.total` e `after24h.total` representam o total de cada janela
- o frontend pode usar `total.count` / `total.value` como base de 100% para exibir os cards
- `referenceAt` aceita timestamp com offset (`-03:00`) ou sem offset; quando o offset nao vier, a API assume `America/Sao_Paulo` (`UTC-3`)
- `referenceAt` tambem aceita `YYYY-MM-DD`; nesse caso, a API interpreta o valor como o fim do dia em `America/Sao_Paulo` (`23:59:59.999`)

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "total": {
    "count": 45,
    "value": "39150.0000"
  },
  "within24h": {
    "total": {
      "count": 30,
      "value": "25650.0000"
    },
    "converted": {
      "count": 12,
      "value": "12450.0000",
      "percentage": "26.67"
    },
    "lost": {
      "count": 8,
      "value": "3500.0000",
      "percentage": "17.78"
    },
    "open": {
      "count": 10,
      "value": "9700.0000",
      "percentage": "22.22"
    }
  },
  "after24h": {
    "total": {
      "count": 15,
      "value": "13500.0000"
    },
    "converted": {
      "count": 7,
      "value": "8400.0000",
      "percentage": "15.56"
    },
    "lost": {
      "count": 3,
      "value": "900.0000",
      "percentage": "6.67"
    },
    "open": {
      "count": 5,
      "value": "4200.0000",
      "percentage": "11.11"
    }
  }
}
```

Exemplo:

```text
GET /kpis/budgets/follow-up/summary?from=2026-01-01&to=2026-01-31&referenceAt=2026-01-31T18:30:00-03:00&sellerId=35747&orderType=Pedido%20Televendas
```

### `GET /kpis/budgets/follow-up/daily`

Descricao:
serie diaria do follow-up de orcamentos, usando `date` como bucket de abertura do budget (`budgetDate`) e classificando cada ponto em `within24h` ou `after24h` com `converted`, `lost` e `open`.

Query Params:

- `from` required: inicio do recorte do bucket de abertura do budget (`budgetDate`)
- `to` required: fim do recorte do bucket de abertura do budget (`budgetDate`)
- `referenceAt` required: data e hora de referencia enviada pelo frontend
- `sellerId` optional
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Regra:

- primeiro a API seleciona somente os orcamentos cuja abertura (`budgetDate`) caiu entre `from` e `to`
- cada item de `rows` usa `date` como bucket de abertura do budget, e nao `budgetDatetime`
- `budgetDatetime` e usado para o tempo de follow-up e para a classificacao em `referenceAt`, inclusive para excluir registros abertos depois de `referenceAt`
- a classificacao considera o estado do orcamento em `referenceAt`, e nao o estado atual
- budgets `LOST` passam a usar `cancellationDate + cancelationTime` como timestamp terminal; budgets `WON` continuam usando `closingDate + closing_time`
- se `cancelationTime` nao existir ou vier invalido, o cancelamento cai no fim do dia de `cancellationDate`
- `followUpWindow` e `followUpStatus` sao classificacoes de follow-up, e nao filtros brutos de status do budget
- `referenceAt` aceita timestamp com offset (`-03:00`) ou, nas formas sem offset que o backend normaliza (`YYYY-MM-DDTHH:mm` ou `YYYY-MM-DDTHH:mm:ss`, com `T` ou espaco), a API assume `America/Sao_Paulo` (`UTC-3`)
- `referenceAt` tambem aceita `YYYY-MM-DD`; nesse caso, a API interpreta o valor como o fim do dia em `America/Sao_Paulo` (`23:59:59.999`)
- o frontend pode usar `rows[].date` junto com `rows[].window` e `rows[].status` para montar a grade diaria
- a resposta vem densa/zero-filled para cada dia solicitado e para cada combinacao de `window` e `status`, mesmo quando nao houver registros

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "rows": [
    {
      "date": "2026-01-05",
      "window": "within24h",
      "status": "converted",
      "count": 2,
      "value": "240.0000"
    },
    {
      "date": "2026-01-05",
      "window": "within24h",
      "status": "lost",
      "count": 0,
      "value": "0.0000"
    }
  ]
}
```

Exemplo:

```text
GET /kpis/budgets/follow-up/daily?from=2026-01-01&to=2026-01-31&referenceAt=2026-01-31T18:30:00-03:00&sellerId=7&orderType=Balcao
```

### `GET /kpis/budgets/follow-up/drilldown`

Descricao:
detalhamento auditavel do follow-up por registro, com filtros de classificacao e o bucket de abertura do budget (`budgetDate`).

Query Params:

- `from` required: inicio do recorte do bucket de abertura do budget (`budgetDate`)
- `to` required: fim do recorte do bucket de abertura do budget (`budgetDate`)
- `referenceAt` required: data e hora de referencia enviada pelo frontend
- `date` optional: bucket de abertura do budget (`budgetDate`)
- `followUpWindow` optional: classificacao de follow-up (`within24h` ou `after24h`)
- `followUpStatus` optional: classificacao de follow-up (`converted`, `lost` ou `open`)
- `sellerId` optional
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Regra:

- primeiro a API seleciona somente os orcamentos cuja abertura (`budgetDate`) caiu entre `from` e `to`
- `date` filtra pelo bucket de abertura do budget (`budgetDate`), e nao por `budgetDatetime`
- `budgetDatetime` e usado para o tempo de follow-up e para a classificacao em `referenceAt`, inclusive para excluir registros abertos depois de `referenceAt`
- `followUpWindow` e `followUpStatus` sao classificacoes de follow-up, e nao filtros brutos de status do budget
- a classificacao considera o estado do orcamento em `referenceAt`, e nao o estado atual
- se um orcamento fechou depois de `referenceAt`, ele ainda entra como `open` naquela consulta
- budgets `LOST` usam `cancellationDate + cancelationTime` como timestamp terminal; budgets `WON` usam `closingDate + closing_time`
- se `cancelationTime` nao existir ou vier invalido, o cancelamento cai no fim do dia de `cancellationDate`
- `referenceAt` aceita timestamp com offset (`-03:00`) ou, nas formas sem offset que o backend normaliza (`YYYY-MM-DDTHH:mm` ou `YYYY-MM-DDTHH:mm:ss`, com `T` ou espaco), a API assume `America/Sao_Paulo` (`UTC-3`)
- `referenceAt` tambem aceita `YYYY-MM-DD`; nesse caso, a API interpreta o valor como o fim do dia em `America/Sao_Paulo` (`23:59:59.999`)
- o objeto `filters` da resposta ecoa `referenceAt` e inclui `date`, `followUpWindow`, `followUpStatus`, `sellerId` e `orderType` quando esses filtros forem informados

Exemplo:

```text
GET /kpis/budgets/follow-up/drilldown?from=2026-01-01&to=2026-01-31&referenceAt=2026-01-31T18:30:00-03:00&date=2026-01-05&sellerId=7&orderType=Balcao&followUpWindow=within24h&followUpStatus=lost
```

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "filters": {
    "referenceAt": "2026-01-31T18:30:00-03:00",
    "date": "2026-01-05",
    "followUpWindow": "within24h",
    "followUpStatus": "lost",
    "sellerId": 7,
    "orderType": "Balcao"
  },
  "rows": [
    {
      "id": "99",
      "sourceTable": "raw.ferraco_budgets",
      "sourceRecordId": 123,
      "budgetDate": "2026-01-05",
      "budgetDatetime": "2026-01-05T09:30:00.000Z",
      "closingDate": null,
      "cancellationDate": "2026-01-05",
      "cancelationTime": "11:15:00",
      "branchId": 5,
      "branchName": "Matriz",
      "sellerId": 7,
      "sellerName": "Maria",
      "statusNormalized": "LOST",
      "channel": "Balcao",
      "customerName": "ACME LTDA",
      "cpfCnpj": null,
      "valueAmount": "200.5000",
      "sequential": null,
      "davId": "777",
      "sequentialLinkedSale": null,
      "payloadJson": {
        "family": "budgets"
      },
      "followUpWindow": "within24h",
      "followUpStatus": "lost"
    }
  ]
}
```

### `POST /kpis/budgets/follow-up/dkw-dispatch`

Descricao:
dispara para o webhook DKW os orcamentos de follow-up classificados como `after24h` e `open`, sem reenviar registros que ja tenham `raw.ferraco_budgets.sent_dkw_at`.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Ou, para automacao backend-only:

```http
X-Job-Key: <job-key>
```

Query Params:

- `slug` optional no modo JWT, required quando usar `X-Job-Key`
- `from` required: inicio do recorte de aberturas
- `to` required: fim do recorte de aberturas
- `referenceAt` required: data e hora de referencia da classificacao
- `sellerId` optional
- `branchId` optional
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Regra:

- o endpoint reutiliza a mesma classificacao de follow-up dos endpoints `summary`, `daily` e `drilldown`
- somente orcamentos classificados como `after24h` e `open` entram no disparo
- o estado de envio fica em `raw.ferraco_budgets.sent_dkw_at`
- se `sent_dkw_at` ja estiver preenchido, o registro e ignorado
- o destino do webhook prioriza `core.employees.dkw_webhook` para o vendedor da filial; sem valor, a API usa `BUDGET_FOLLOW_UP_DKW_WEBHOOK_URL` como fallback
- em sucesso no webhook, a API grava `sent_dkw_at`
- em erro de um item, a API continua; se houver 3 erros seguidos, a execucao aborta
- o payload usa `cell_phone`, fallback `phone`, fallback final `Sem registro`
- quando nao houver telefone em nenhum dos dois campos, a API tambem envia `mensagem = "Sem telefone registrado"`
- o payload enviado ao DKW formata `valor_orcamento` como moeda BRL (`R$ 0,00`) e `data_hora_abertura` como `dd/MM/yyyy`
- `referenceAt` aceita timestamp com offset (`-03:00`) ou, nas formas sem offset que o backend normaliza (`YYYY-MM-DDTHH:mm` ou `YYYY-MM-DDTHH:mm:ss`, com `T` ou espaco), a API assume `America/Sao_Paulo` (`UTC-3`)
- `referenceAt` tambem aceita `YYYY-MM-DD`; nesse caso, a API interpreta o valor como o fim do dia em `America/Sao_Paulo` (`23:59:59.999`)

Exemplo:

```text
POST /kpis/budgets/follow-up/dkw-dispatch?from=2026-04-01&to=2026-04-02&referenceAt=2026-04-02T10:00:00-03:00&sellerId=7&branchId=5&orderType=Balcao
```

Exemplo com automacao:

```text
POST /kpis/budgets/follow-up/dkw-dispatch?slug=ferracosul-kpi-dev&from=2026-04-01&to=2026-04-08&referenceAt=2026-04-08T16:00:00-03:00
```

Response `200`:

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

Status HTTP:

- `200` quando o dispatch conclui o processamento do lote
- `400` para query params invalidos
- `401` para JWT invalido ou ausente, ou `X-Job-Key` invalida
- `403` quando `branchId` nao pertence ao escopo da empresa no modo autenticado por usuario
- `404` para `slug` inexistente ou tenant inativo no modo `X-Job-Key`
- `409` para tenant sem `backendClientId` ou com backend client inativo no modo `X-Job-Key`

### `GET /kpis/budgets/hourly`

Descricao:
serie por hora de `00` a `23`.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "series": [
    {
      "hour": "08",
      "count": 2,
      "value": "150.0000"
    },
    {
      "hour": "10",
      "count": 1,
      "value": "25.0000"
    }
  ]
}
```

### `GET /kpis/budgets/channel/daily`

Descricao:
orcamentos por dia e por canal.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "date": "2026-01-05",
      "orderType": "Nao identificado",
      "count": 1,
      "value": "100.0000"
    },
    {
      "date": "2026-01-05",
      "orderType": "Televendas",
      "count": 1,
      "value": "50.0000"
    }
  ]
}
```

### `GET /kpis/budgets/channel/hourly`

Descricao:
orcamentos por hora e por canal.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "hour": "08",
      "orderType": "Nao identificado",
      "count": 2,
      "value": "150.0000"
    }
  ]
}
```

### `GET /kpis/budgets/channel/abandonment`

Descricao:
abandono por canal, equivalente a orcamentos `Cancelado` agrupados por `orderType`.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "orderType": "Nao identificado",
      "count": 1,
      "value": "100.0000"
    }
  ]
}
```

### `GET /kpis/budgets/drilldown`

Descricao:
detalhamento auditavel por registro.

Cada linha expõe tambem `cancellationDate` e `cancelationTime` quando o budget tiver cancelamento estruturado normalizado.

Query Params:

- `from` required
- `to` required
- `sellerId` optional
- `status` optional: `Cancelado`, `Baixado`, `Pendente`
- `branchId` optional
- `branchName` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Exemplo:

```text
GET /kpis/budgets/drilldown?from=2026-01-01&to=2026-01-31&sellerId=35747&status=Cancelado
```

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "filters": {
    "sellerId": 7,
    "status": "Cancelado",
    "branchId": 5,
    "branchName": "Matriz"
  },
  "rows": [
    {
      "id": "99",
      "sourceTable": "raw.ferraco_budgets",
      "sourceRecordId": 123,
      "budgetDate": "2026-01-02",
      "budgetDatetime": "2026-01-02T09:30:00.000Z",
      "closingDate": null,
      "cancellationDate": "2026-01-03",
      "cancelationTime": "15:30:00",
      "branchId": 5,
      "branchName": "Matriz",
      "sellerId": 7,
      "sellerName": "Maria",
      "statusNormalized": "LOST",
      "channel": null,
      "customerName": "ACME LTDA",
      "cpfCnpj": null,
      "valueAmount": "200.5000",
      "sequential": null,
      "davId": "777",
      "sequentialLinkedSale": null,
      "payloadJson": {
        "family": "budgets"
      }
    }
  ]
}
```

## Sales KPI

### Filters

Sales aceitam:

- `from` required
- `to` required
- `sellerId` optional
- `status` optional: `Ativa`, `Cancelada`
- `orderType` optional
- `hasLinkedBudget` optional: `true`, `false`

Quando `sellerId` e informado nas rotas de sales, ele representa `core.employee_erp_users.erp_id`.
Para filtrar por **pessoa** em varias lojas, veja o guia em `GET /companies/current/employees` (resolver `erpUsers[].erpId` por `branchId`; loja sem vinculo = 0).

Em vendas, `orderType` vem do budget vinculado por:

`sale.sequential = budget_fact.sequential_linked_sale`

Se nao houver budget vinculado, o canal retorna `Nao identificado`.

`hasLinkedBudget=true` retorna apenas vendas com budget vinculado. `hasLinkedBudget=false` retorna apenas vendas sem budget vinculado.

Os filtros acima valem para:

- `GET /kpis/sales/summary`
- `GET /kpis/sales/daily`
- `GET /kpis/sales/channel/daily`
- `GET /kpis/sales/ticket-average`
- `GET /kpis/sales/drilldown`

### `POST /kpis/sales/refresh`

Descricao:
normaliza vendas e recalcula a materializacao do periodo.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `from`
- `to`

Response `200`:

```json
{
  "clientId": "ferracosul",
  "from": "2026-03-01",
  "to": "2026-03-23",
  "calculationRunId": "12",
  "recordsRead": 6824,
  "snapshotsCreated": 9,
  "breakdownsCreated": 46,
  "availabilityEnabled": true
}
```

### `GET /kpis/sales/summary`

Descricao:
retorna cards consolidados de vendas.

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-23",
    "key": "2026-03-01_2026-03-23"
  },
  "total": {
    "count": 6824,
    "value": "4640684.08"
  },
  "active": {
    "count": 6346,
    "value": "4052458.85"
  },
  "canceled": {
    "count": 478,
    "value": "588225.23"
  },
  "averageDaily": {
    "count": "296.6957",
    "value": "201768.873"
  },
  "averageTicket": {
    "value": "680.0534"
  }
}
```

Exemplo:

```text
GET /kpis/sales/summary?from=2026-03-01&to=2026-03-23&sellerId=35747&status=Cancelada&orderType=Pedido%20Televendas&hasLinkedBudget=true
```

### `GET /kpis/sales/daily`

Descricao:
serie diaria de vendas por quantidade e valor.

Query Params:

- filtros da secao `Sales KPI > Filters`

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-03",
    "key": "2026-01-01_2026-01-03"
  },
  "series": [
    {
      "date": "2026-01-01",
      "count": 2,
      "value": "150.0000"
    }
  ]
}
```

### `GET /kpis/sales/channel/daily`

Descricao:
vendas por dia e por canal.

Query Params:

- filtros da secao `Sales KPI > Filters`

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-03",
    "key": "2026-03-01_2026-03-03"
  },
  "rows": [
    {
      "date": "2026-03-02",
      "orderType": "Nao identificado",
      "count": 396,
      "value": "211968.5700"
    },
    {
      "date": "2026-03-02",
      "orderType": "Pedido Televendas",
      "count": 15,
      "value": "32323.0100"
    }
  ]
}
```

### `GET /kpis/sales/ticket-average`

Descricao:
ticket medio geral e por canal.

Query Params:

- filtros da secao `Sales KPI > Filters`

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-23",
    "key": "2026-03-01_2026-03-23"
  },
  "overall": {
    "count": 6346,
    "value": "4052458.8500",
    "averageTicket": "638.5848"
  },
  "channels": [
    {
      "orderType": "Nao identificado",
      "count": 6214,
      "value": "3676293.9700",
      "averageTicket": "591.6147"
    },
    {
      "orderType": "Pedido Televendas",
      "count": 132,
      "value": "376164.8800",
      "averageTicket": "2849.7339"
    }
  ]
}
```

### `GET /kpis/sales/drilldown`

Descricao:
retorna as vendas detalhadas do periodo, com filtros opcionais.

Query Params:

- filtros da secao `Sales KPI > Filters`

Response `200`:

```json
{
  "period": {
    "from": "2026-03-02",
    "to": "2026-03-02",
    "key": "2026-03-02_2026-03-02"
  },
  "filters": {
    "sellerId": 35747,
    "status": "Cancelada",
    "orderType": "Pedido Televendas",
    "hasLinkedBudget": true
  },
  "rows": [
    {
      "id": "99",
      "sourceTable": "raw.ferraco_sales",
      "sourceRecordId": 123,
      "saleDate": "2026-03-02",
      "saleDatetime": "2026-03-02T14:33:00.000Z",
      "branchId": 5,
      "branchName": "Matriz",
      "sellerId": 35747,
      "sellerName": "Maria",
      "statusNormalized": "CANCELED",
      "channel": "Pedido Televendas",
      "hasLinkedBudget": true,
      "linkedBudgetSourceRecordId": 777,
      "customerName": "ACME LTDA",
      "cpfCnpj": null,
      "valueAmount": "200.5000",
      "sequential": "888",
      "invoiceSerie": "1",
      "invoiceNumeric": "42",
      "listDavsId": "11,12",
      "payloadJson": {
        "family": "sales"
      }
    }
  ]
}
```

## Calls KPI

### Filters

Calls aceitam:

- `from` required
- `to` required
- `branchId` optional
- `extensionUuid` optional
- `extensionNumber` optional

As ligacoes sao calculadas a partir de `raw.ferraco_calls`, considerando somente chamadas `inbound` para ramais numericos curtos. A importacao casa `raw.ferraco_calls.domain_uuid` com `core.branches.telephony_domain_uuid`; `core.sinapse_clients` continua sendo o cliente/tenant backend, nao a filial.
Quando `branchId` e informado, a API filtra diretamente por `core.call_facts.branch_id`, salvo durante a normalizacao.
Quando `extensionUuid` e informado, a API filtra diretamente por `call_facts.extension_uuid`.
Quando `extensionNumber` e informado, a API tambem inclui chamadas perdidas sem `extension_uuid`, desde que o ramal resolvido em `agent_extension_number` / `agent_resolution_key` bata com o valor enviado.
Lookup de employee/ramal em calls fica para nomes, agent labels e exclusoes de funcionarios nao comerciais; nao decide ownership da filial.

Contrato para o frontend:

- listar filiais em `GET /companies/current/branches`
- enviar `branchId=<branch.id>` quando o usuario selecionar uma filial
- nao enviar `domainUuid` em filtros de calls; ele e um detalhe interno de importacao
- sem `branchId`, as rotas de calls retornam o consolidado de todas as filiais do tenant ativo

### `POST /kpis/calls/refresh`

Descricao:
normaliza ligacoes e recalcula a materializacao do periodo.

O refresh continua resolvido pelo `clientId` do tenant ativo. Para calls, ele importa todos os dominios de telefonia configurados nas filiais desse cliente via `core.branches.telephony_domain_uuid`.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `from`
- `to`

Response `200`:

```json
{
  "clientId": "ferracosul",
  "from": "2026-01-01",
  "to": "2026-01-31",
  "calculationRunId": "14",
  "recordsRead": 10354,
  "snapshotsCreated": 5,
  "breakdownsCreated": 153,
  "availabilityEnabled": true
}
```

Notas operacionais:

- antes de rodar refresh de chamadas em producao, popular `core.branches.telephony_domain_uuid` para todas as filiais
- reprocessar intervalos historicos afetados depois de preencher/corrigir dominios de telefonia
- backfillar `core.call_facts.branch_id` antes de confiar em dashboards historicos filtrados por filial

SQL de backfill:

```sql
UPDATE core.call_facts AS fact
SET branch_id = branch.id,
    updated_at = NOW()
FROM core.branches AS branch
WHERE fact.domain_uuid = branch.telephony_domain_uuid
  AND fact.client_id = branch.client_id
  AND fact.branch_id IS DISTINCT FROM branch.id;
```

### `GET /kpis/calls/summary`

Descricao:
retorna cards consolidados de ligacoes recebidas, perdidas, total inbound, orcamentos abertos de televendas e pico por hora.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31",
    "key": "2026-01-01_2026-01-31"
  },
  "received": {
    "count": 6741
  },
  "lost": {
    "count": 4945
  },
  "totalInbound": {
    "count": 11686
  },
  "telemarketingOpenBudgets": {
    "count": 189
  },
  "peakHour": {
    "hour": "10",
    "totalInboundCount": 742
  }
}
```

### `GET /kpis/calls/hourly`

Descricao:
serie por hora de `00` a `23` com recebidas, perdidas e total inbound.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "hour": "08",
      "receivedCount": 12,
      "lostCount": 4,
      "totalInboundCount": 16
    }
  ]
}
```

### `GET /kpis/calls/agents/ranking`

Descricao:
ranking por atendente quando houver cadastro; caso contrario, o fallback e o ramal.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "agentType": "EMPLOYEE",
      "agentKey": "employee:ext-1",
      "agentLabel": "Maria",
      "employeeName": "Maria",
      "extensionNumber": "104",
      "receivedCount": 8,
      "lostCount": 1,
      "totalInboundCount": 9
    },
    {
      "agentType": "EXTENSION",
      "agentKey": "extension:107",
      "agentLabel": "107",
      "employeeName": null,
      "extensionNumber": "107",
      "receivedCount": 0,
      "lostCount": 3,
      "totalInboundCount": 3
    }
  ]
}
```

### `GET /kpis/calls/hourly/comparison`

Descricao:
comparativo horario entre ligacoes recebidas, ligacoes perdidas e orcamentos do canal `Pedido Televendas`.

Response `200`:

```json
{
  "period": {
    "from": "2026-01-05",
    "to": "2026-01-05",
    "key": "2026-01-05_2026-01-05"
  },
  "rows": [
    {
      "hour": "08",
      "receivedCount": 12,
      "lostCount": 4,
      "telemarketingBudgetCount": 3
    }
  ]
}
```

## Internal Jobs

### `POST /internal/jobs/kpis/refresh`

Descricao:
endpoint interno para automacao backend-only que aceita um refresh assíncrono com suporte atual de `budgets`, `sales` e `calls` para um unico tenant resolvido por `slug`.

Este endpoint:

- e destinado a cron, scheduler ou automacao de servidor
- nao usa JWT
- nao exige `Authorization`
- nao exige `X-Tenant-Id`
- exige `X-Job-Key`
- resolve o `clientId` real via `tenant.backendClientId`
- persiste um `refresh_job` e responde sem esperar a execucao terminar

Headers:

- `X-Job-Key` required

Query Params:

- `slug` required
- `from` required
- `to` required

Response `202`:

```json
{
  "status": "accepted",
  "message": "task initiated",
  "jobId": "41"
}
```

Status HTTP:

- `202` quando a requisicao foi autenticada, o tenant foi resolvido e o job foi persistido para execucao em background
- `400` para query params invalidos
- `401` para `X-Job-Key` ausente ou invalido
- `404` para `slug` inexistente ou tenant inativo
- `409` para tenant sem `backendClientId` ou com backend client inativo

### `GET /internal/jobs/kpis/refresh/:jobId`

Descricao:
consulta o status persistido de um `refresh_job` aceito anteriormente.

Headers:

- `X-Job-Key` required

Path Params:

- `jobId` required

Response `200`:

```json
{
  "jobId": "41",
  "status": "PARTIAL_SUCCESS",
  "slug": "ferracosul-kpi-dev",
  "tenantId": "tenant-1",
  "clientId": "ferracosul",
  "from": "2026-04-01",
  "to": "2026-04-06",
  "triggerType": "api",
  "requestedAt": "2026-04-08T12:00:00.000Z",
  "startedAt": "2026-04-08T12:00:01.000Z",
  "finishedAt": "2026-04-08T12:00:09.000Z",
  "errorMessage": "sales: Sale refresh failed",
  "results": {
    "overallStatus": "partial_success",
    "results": [
      {
        "job": "budgets",
        "status": "success",
        "startedAt": "2026-04-08T12:00:01.000Z",
        "finishedAt": "2026-04-08T12:00:03.000Z"
      },
      {
        "job": "sales",
        "status": "failed",
        "startedAt": "2026-04-08T12:00:03.000Z",
        "finishedAt": "2026-04-08T12:00:05.000Z",
        "error": "Sale refresh failed"
      },
      {
        "job": "calls",
        "status": "success",
        "startedAt": "2026-04-08T12:00:05.000Z",
        "finishedAt": "2026-04-08T12:00:09.000Z"
      }
    ]
  }
}
```

Observacoes:

- `results` fica `null` enquanto o job estiver em `PENDING` ou `RUNNING`
- este fluxo permanece backend-only e nao usa JWT
- o contrato HTTP permite migrar a execucao em memoria para fila ou worker depois sem quebrar a API

Semantica de status:

- `SUCCESS`: os tres refreshs completaram com sucesso
- `PARTIAL_SUCCESS`: pelo menos um refresh teve sucesso e pelo menos um falhou
- `FAILED`: todos os refreshs falharam

Status HTTP:

- `200` quando o job existe e o status foi lido
- `400` para `jobId` invalido
- `401` para `X-Job-Key` ausente ou invalido
- `404` para `jobId` inexistente

## Internal Messaging (FLW + DKW)

Endpoints internos para importacao e validacao do modelo canônico de mensageria (`core.messaging_sessions`, `core.messaging_messages`).

Headers em todas as rotas:

- `X-Job-Key` required (mesmo valor de `INTERNAL_JOB_KEY`)

### `POST /internal/messaging/sync`

Sincroniza sessions/messages do FLW Chat para `raw.flw_*` e normaliza para o canônico.

Query Params:

- `clientId` required (slug do `sinapse_client`, ex.: `ferracosul`)

Response `200`:

```json
{
  "clientId": "ferracosul",
  "sessionsFetched": 120,
  "messagesFetched": 3400,
  "sessionsWritten": 120,
  "messagesWritten": 3400
}
```

### `POST /internal/messaging/migrate-dkw`

Copia conversas legadas DKW (`core.sessions`, `core.messages`) para o canônico com `provider='DKW'`. **Nao altera** as tabelas legadas.

A migracao roda **mes a mes** entre `from` e `to`, processando mensagens em lotes dentro de cada janela mensal.

Query Params:

- `clientId` required
- `from` required (`YYYY-MM-DD`) — inicio do historico a migrar
- `to` required (`YYYY-MM-DD`) — fim do historico a migrar
- `batchSize` optional (default `2000`, max `10000`) — tamanho do lote de mensagens dentro de cada mes

Exemplo para migrar todo o historico DKW de uma vez:

```http
POST /internal/messaging/migrate-dkw?clientId=ferracosul&from=2020-01-01&to=2026-06-15
```

O servico divide automaticamente em janelas mensais (`2020-01-01..2020-01-31`, `2020-02-01..2020-02-29`, ...) e executa **em background**. Acompanhe o progresso no terminal com prefixo `[dkw-migrate]` ou consulte o status do job.

Response `202`:

```json
{
  "status": "accepted",
  "message": "task initiated",
  "jobId": "f8b3c2a1-4e5d-6789-abcd-ef0123456789"
}
```

### `GET /internal/messaging/migrate-dkw/:jobId`

Consulta o status de um job aceito anteriormente.

Response `200` enquanto roda:

```json
{
  "jobId": "f8b3c2a1-4e5d-6789-abcd-ef0123456789",
  "clientId": "ferracosul",
  "from": "2020-01-01",
  "to": "2026-06-15",
  "batchSize": 2000,
  "status": "RUNNING",
  "requestedAt": "2026-06-15T12:00:00.000Z",
  "startedAt": "2026-06-15T12:00:01.000Z",
  "finishedAt": null,
  "errorMessage": null,
  "result": null
}
```

Quando concluir, `status` vira `COMPLETED` e `result` traz os totais agregados:

```json
{
  "status": "COMPLETED",
  "result": {
    "windowsProcessed": 78,
    "totals": {
      "messagesExpected": 380000,
      "messagesWritten": 380000,
      "messagesSkippedMissingSession": 0
    }
  }
}
```

Status possiveis: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`.

Somente **um job por `clientId`** pode rodar por vez. Se ja houver migracao em andamento, a API responde `409 Conflict`.

### `GET /internal/messaging/parity`

Compara legado vs canônico DKW em um intervalo (sessions, mensagens inbound humanas e ranking por email).

Query Params:

- `clientId` required
- `from` required (`YYYY-MM-DD`)
- `to` required (`YYYY-MM-DD`)
- `topAgents` optional (default `5`)

### `POST /webhooks/flw/:clientId`

Webhook publico do FLW Chat. O evento vem no body (`eventType` + `content`). Configure `FLW_WEBHOOK_SECRET` e, para debug, `FLW_WEBHOOK_DEBUG=true`.

Rollout recomendado:

1. aplicar migrations do messaging canônico
2. popular `core.branches.flw_department_id`
3. configurar `FLW_CHAT_API_TOKEN` e webhook
4. rodar `POST /internal/messaging/sync`
5. rodar `POST /internal/messaging/migrate-dkw`
6. validar `GET /internal/messaging/parity`
7. setar `WHATSAPP_KPI_SOURCE=canonical` (ou `dual` para diagnostico)

## WhatsApp KPI

### Filters

WhatsApp e mensageria aceitam:

- `from` required
- `to` required
- `chatId` optional
- `branchId` optional
- `tagId` required apenas nas rotas por tag
- `sellerId` optional apenas em `GET /kpis/whatsapp/tags/hourly/comparison`

As metricas sao lidas das tabelas canonicas de mensageria. Por padrao (`WHATSAPP_KPI_SOURCE=legacy`), a origem continua sendo `core.sessions`, `core.messages`, `core.tickets`, `core.contacts`, `core.tags` e `core.contact_tags`.

Com `WHATSAPP_KPI_SOURCE=canonical`, summary/ranking/hourly/daily passam a ler `core.messaging_sessions` e `core.messaging_messages`. O modo `dual` executa ambas as queries e registra divergencias no log do servidor, mantendo a resposta da API no formato legado.

KPIs por tag continuam no legado ate fase futura de contatos/tags no canônico.

Quando `chatId` e informado nas rotas analiticas de WhatsApp, ele representa o email do atendente. No legado filtra `core.sessions.assigned_user_email`; no canônico filtra `core.messaging_sessions.assigned_agent_email` (case-insensitive).

Quando `branchId` e informado no legado, o filtro e derivado de employee: `lower(btrim(core.employees.chat_id))` precisa casar com `lower(btrim(core.sessions.assigned_user_email))`. No canônico, filtra diretamente `core.messaging_sessions.branch_id` (mapeado via `branches.flw_department_id` para FLW).

Quando `sellerId` e informado em `GET /kpis/whatsapp/tags/hourly/comparison`, ele filtra somente `openBudgetsCount` pelo mesmo identificador de budgets e sales: `core.employee_erp_users.erp_id` / `core.budget_facts.seller_id`.

### `GET /kpis/whatsapp/summary`

Descricao:
retorna o total de conversas e o total de mensagens recebidas no periodo.

Query Params:

- `from`
- `to`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-31",
    "key": "2026-03-01_2026-03-31"
  },
  "totalConversations": {
    "count": 440
  },
  "receivedMessages": {
    "count": 1880
  }
}
```

### `GET /kpis/whatsapp/agents/ranking`

Descricao:
ranking de atendentes por sessoes, com fallback `Nao atribuido` quando a sessao nao tiver atendente.

Query Params:

- `from`
- `to`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-31",
    "key": "2026-03-01_2026-03-31"
  },
  "rows": [
    {
      "agentKey": "employee:7",
      "agentLabel": "Maria da Silva",
      "employeeId": "7",
      "employeeName": "Maria da Silva",
      "employeeChatId": "maria@empresa.com",
      "assignedUserName": "Maria",
      "assignedUserEmail": "maria@empresa.com",
      "sessionsCount": 45
    },
    {
      "agentKey": "unassigned",
      "agentLabel": "Nao atribuido",
      "employeeId": null,
      "employeeName": null,
      "employeeChatId": null,
      "assignedUserName": null,
      "assignedUserEmail": null,
      "sessionsCount": 12
    }
  ]
}
```

### `GET /kpis/whatsapp/sessions/hourly`

Descricao:
serie por hora de `00` a `23` com a quantidade de sessoes criadas.

Query Params:

- `from`
- `to`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-05",
    "to": "2026-03-05",
    "key": "2026-03-05_2026-03-05"
  },
  "rows": [
    {
      "hour": "14",
      "sessionsCount": 30
    }
  ]
}
```

### `GET /kpis/whatsapp/sessions/daily`

Descricao:
serie por dia do range com a quantidade de conversas criadas.

Query Params:

- `from`
- `to`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-03",
    "key": "2026-03-01_2026-03-03"
  },
  "rows": [
    {
      "date": "2026-03-01",
      "sessionsCount": 10
    },
    {
      "date": "2026-03-02",
      "sessionsCount": 0
    },
    {
      "date": "2026-03-03",
      "sessionsCount": 12
    }
  ]
}
```

### `GET /kpis/whatsapp/messages/hourly`

Descricao:
serie por hora de `00` a `23` com a quantidade de mensagens recebidas (`from_me = false` e `sender_type = HUMAN`).

Query Params:

- `from`
- `to`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-05",
    "to": "2026-03-05",
    "key": "2026-03-05_2026-03-05"
  },
  "rows": [
    {
      "hour": "14",
      "receivedMessagesCount": 120
    }
  ]
}
```

### `GET /kpis/whatsapp/messages/daily`

Descricao:
serie por dia do range com a quantidade de mensagens recebidas (`from_me = false` e `sender_type = HUMAN`).

Query Params:

- `from`
- `to`
- `chatId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-03",
    "key": "2026-03-01_2026-03-03"
  },
  "rows": [
    {
      "date": "2026-03-01",
      "receivedMessagesCount": 50
    },
    {
      "date": "2026-03-02",
      "receivedMessagesCount": 0
    },
    {
      "date": "2026-03-03",
      "receivedMessagesCount": 40
    }
  ]
}
```

### `GET /kpis/whatsapp/tags`

Descricao:
lista as tags disponiveis para o cliente ativo.

Response `200`:

```json
{
  "tags": [
    {
      "tagId": "21830",
      "tagName": "CLIENTE ATIVO",
      "color": "#020101"
    }
  ]
}
```

### `GET /kpis/whatsapp/tags/hourly`

Descricao:
serie por hora de `00` a `23` para as sessoes associadas a uma tag.

Query Params:

- `from`
- `to`
- `tagId`
- `chatId` optional
- `branchId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-05",
    "to": "2026-03-05",
    "key": "2026-03-05_2026-03-05"
  },
  "tagId": "21830",
  "rows": [
    {
      "hour": "14",
      "sessionsCount": 30
    }
  ]
}
```

### `GET /kpis/whatsapp/tags/hourly/comparison`

Descricao:
comparativo horario entre sessoes da tag selecionada e orcamentos abertos no mesmo periodo, sem vincular registros individualmente.

Query Params:

- `from`
- `to`
- `tagId`
- `chatId` optional
- `branchId` optional
- `sellerId` optional

Response `200`:

```json
{
  "period": {
    "from": "2026-03-05",
    "to": "2026-03-05",
    "key": "2026-03-05_2026-03-05"
  },
  "tagId": "21830",
  "rows": [
    {
      "hour": "14",
      "tagSessionsCount": 30,
      "openBudgetsCount": 20
    }
  ]
}
```

## Curl Examples

### Health

```bash
curl -X GET "http://localhost:3000/health"
```

### Login

```bash
curl -X POST "http://localhost:3000/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"ana@example.com\",\"password\":\"secret-123\"}"
```

### Refresh

```bash
curl -X POST "http://localhost:3000/auth/refresh" ^
  -H "Content-Type: application/json" ^
  -d "{\"refreshToken\":\"<refresh-token>\"}"
```

### Tenant Users List

```bash
curl -X GET "http://localhost:3000/tenant-users" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Tenant Users Create

```bash
curl -X POST "http://localhost:3000/tenant-users" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"new.user@example.com\",\"name\":\"New User\",\"password\":\"secret-123\",\"role\":\"VIEWER\"}"
```

### Tenant Users Update

```bash
curl -X PATCH "http://localhost:3000/tenant-users/u-viewer" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Viewer Updated\",\"password\":\"after-123\",\"role\":\"MANAGER\",\"isActive\":true,\"membershipIsActive\":false}"
```

### Budget Summary

```bash
curl -X GET "http://localhost:3000/kpis/budgets/summary?from=2026-01-01&to=2026-01-31&sellerId=35747&status=Baixado&orderType=Nao%20identificado" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Budget Follow-Up Summary

```bash
curl -X GET "http://localhost:3000/kpis/budgets/follow-up/summary?from=2026-01-01&to=2026-01-31&referenceAt=2026-01-31T18:30:00-03:00&sellerId=35747&orderType=Pedido%20Televendas" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Sales Summary

```bash
curl -X GET "http://localhost:3000/kpis/sales/summary?from=2026-03-01&to=2026-03-23&status=Ativa&hasLinkedBudget=true" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Sales Refresh

```bash
curl -X POST "http://localhost:3000/kpis/sales/refresh?from=2026-03-01&to=2026-03-23" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Calls Summary

```bash
curl -X GET "http://localhost:3000/kpis/calls/summary?from=2026-01-01&to=2026-01-31&branchId=1&extensionUuid=ext-101&extensionNumber=101" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### Calls Refresh

```bash
curl -X POST "http://localhost:3000/kpis/calls/refresh?from=2026-01-01&to=2026-01-31" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### WhatsApp Summary

```bash
curl -X GET "http://localhost:3000/kpis/whatsapp/summary?from=2026-03-01&to=2026-03-31&chatId=maria@empresa.com" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### WhatsApp Sessions Daily

```bash
curl -X GET "http://localhost:3000/kpis/whatsapp/sessions/daily?from=2026-03-01&to=2026-03-03&chatId=maria@empresa.com" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```

### WhatsApp Tag Comparison

```bash
curl -X GET "http://localhost:3000/kpis/whatsapp/tags/hourly/comparison?from=2026-03-01&to=2026-03-31&tagId=21830&chatId=maria@empresa.com&sellerId=35747" ^
  -H "Authorization: Bearer <jwt>" ^
  -H "X-Tenant-Id: tenant-ferracosul-kpi-dev"
```
