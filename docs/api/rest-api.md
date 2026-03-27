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

### `GET /companies/current/employees`

Descricao:
lista funcionarios da empresa atual.

Headers:

```http
Authorization: Bearer <jwt>
X-Tenant-Id: <tenant-id>
```

Query Params:

- `branchId` optional, integer
- `search` optional, text

Exemplo:

```text
GET /companies/current/employees?branchId=1&search=fabiano
```

Response `200`:

```json
[
  {
    "id": 35747,
    "erpId": 35747,
    "name": "Fabiano Pereira da Silva",
    "branchId": 1,
    "extensionNumber": "101",
    "extensionUuid": "3c5f7f91-6b21-4b4d-a7a0-2d5f8e7a1234",
    "chatId": "fabiano@empresa.com"
  }
]
```

`erpId` e o identificador usado como `sellerId` nas rotas de `budgets` e `sales`.

## Budgets KPI

### Filters

Budgets aceitam:

- `from` required
- `to` required
- `sellerId` optional
- `status` optional: `Cancelado`, `Baixado`, `Pendente`
- `orderType` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employees.erp_id`.

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

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employees.erp_id`.

Regra:

- primeiro a API seleciona somente os orcamentos cuja abertura (`budgetDate` / `budgetDatetime`) caiu entre `from` e `to`
- a classificacao considera o estado do orcamento em `referenceAt`, e nao o estado atual
- se um orcamento fechou depois de `referenceAt`, ele ainda entra como `open` naquela consulta
- `converted` e `lost` usam a diferenca entre abertura e `closingDate + closing_time`, desde que o fechamento ja tenha acontecido ate `referenceAt`
- `open` usa a diferenca entre abertura e `referenceAt`
- se `closing_time` nao existir no payload bruto, o fechamento cai no fim do dia de `closingDate`
- `percentage` representa a participacao da quantidade sobre o total geral de orcamentos analisados no follow-up
- `total` no topo representa o total geral do follow-up no recorte analisado
- `within24h.total` e `after24h.total` representam o total de cada janela
- o frontend pode usar `total.count` / `total.value` como base de 100% para exibir os cards
- `referenceAt` aceita timestamp com offset (`-03:00`) ou sem offset; quando o offset nao vier, a API assume `America/Sao_Paulo` (`UTC-3`)

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

Query Params:

- `from` required
- `to` required
- `sellerId` optional
- `status` optional: `Cancelado`, `Baixado`, `Pendente`
- `branchId` optional
- `branchName` optional

Quando `sellerId` e informado nas rotas de budgets, ele representa `core.employees.erp_id`.

Exemplo:

```text
GET /kpis/budgets/drilldown?from=2026-01-01&to=2026-01-31&sellerId=35747&status=Baixado
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
    "status": "Baixado",
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
      "branchId": 5,
      "branchName": "Matriz",
      "sellerId": 7,
      "sellerName": "Maria",
      "statusNormalized": "WON",
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

Quando `sellerId` e informado nas rotas de sales, ele representa `core.employees.erp_id`.

Em vendas, `orderType` vem do budget vinculado por:

`sale.sequential = budget_fact.sequential_linked_sale`

Se nao houver budget vinculado, o canal retorna `Nao identificado`.

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
GET /kpis/sales/summary?from=2026-03-01&to=2026-03-23&sellerId=35747&status=Cancelada&orderType=Pedido%20Televendas
```

### `GET /kpis/sales/daily`

Descricao:
serie diaria de vendas por quantidade e valor.

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

## Calls KPI

### Filters

Calls aceitam:

- `from` required
- `to` required
- `extensionUuid` optional
- `extensionNumber` optional

As ligacoes sao calculadas a partir de `raw.ferraco_calls`, considerando somente chamadas `inbound` para ramais numericos curtos.
Quando `extensionUuid` e informado, a API filtra diretamente por `call_facts.extension_uuid`.
Quando `extensionNumber` e informado, a API tambem inclui chamadas perdidas sem `extension_uuid`, desde que o ramal resolvido em `agent_extension_number` / `agent_resolution_key` bata com o valor enviado.

### `POST /kpis/calls/refresh`

Descricao:
normaliza ligacoes e recalcula a materializacao do periodo.

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

## WhatsApp KPI

### Filters

WhatsApp e mensageria aceitam:

- `from` required
- `to` required
- `chatId` optional
- `tagId` required apenas nas rotas por tag
- `sellerId` optional apenas em `GET /kpis/whatsapp/tags/hourly/comparison`

As metricas sao lidas diretamente das tabelas canonicas `core.sessions`, `core.messages`, `core.tickets`, `core.contacts`, `core.tags` e `core.contact_tags`.

Quando `chatId` e informado nas rotas analiticas de WhatsApp, ele representa o email do atendente e o filtro e aplicado diretamente por `core.sessions.assigned_user_email`, com comparacao case-insensitive.

Quando `sellerId` e informado em `GET /kpis/whatsapp/tags/hourly/comparison`, ele filtra somente `openBudgetsCount` pelo mesmo identificador de budgets e sales: `core.employees.erp_id` / `core.budget_facts.seller_id`.

### `GET /kpis/whatsapp/summary`

Descricao:
retorna o total de conversas e o total de mensagens recebidas no periodo.

Query Params:

- `from`
- `to`
- `chatId` optional

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
curl -X GET "http://localhost:3000/kpis/sales/summary?from=2026-03-01&to=2026-03-23&status=Ativa" ^
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
curl -X GET "http://localhost:3000/kpis/calls/summary?from=2026-01-01&to=2026-01-31&extensionUuid=ext-101&extensionNumber=101" ^
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
