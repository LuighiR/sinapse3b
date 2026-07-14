# WhatsApp City Classification Design

Date: 2026-07-14  
Status: Approved in conversation

## Goal

Classificar sessões de WhatsApp (FLW) por **cidade operacional**, independente de `core.branches`, porque o mesmo grupo de atendentes cobre Pelotas, Rio Grande e Santa Maria. A origem da classificação é o `departmentId` (fila FLW) no payload de `raw.flw_sessions` / sessão canônica.

O frontend da diretoria (repositório separado) consome APIs deste backend para:

1. Manter o cadastro editável de cidades e o mapa `departmentId → cidade`
2. Filtrar KPIs WhatsApp por cidade

## Context

- Hoje `core.branches.flw_department_id` é **1:1** (uma fila por filial) e alimenta `messaging_sessions.branch_id`.
- Na prática há **N filas por cidade** (Balcão, Início, Vendas Geral, etc.).
- KPIs WhatsApp já **ignoram** `branchId` no query service; o escopo útil para a diretoria é a cidade WhatsApp.
- Agente não define a cidade: a fila (`departmentId`) define.

## Decisions

| Decisão | Escolha |
| --- | --- |
| Relação com filiais | Independente de `branches` |
| Granularidade de filtro | Só cidade (label da fila é rótulo do mapa) |
| Persistência na sessão | Desnormalizar `whatsapp_city_id` na normalização |
| Cadastro de cidades | Tabela editável `whatsapp_cities` |
| Edição do mapa | Update em massa só das sessões daquele `departmentId` |
| Superfície | CRUD REST neste backend |
| Fila desconhecida | Auto-criar mapeamento `PENDING` |
| KPIs | Filtro `whatsappCityId` |

## Model

### `core.whatsapp_cities`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `client_id` | text | tenant |
| `name` | text | ex. Pelotas |
| `is_active` | boolean | default true; soft-disable |
| `created_at` / `updated_at` | timestamptz | |

Unique: `(client_id, name)`  
FK: `client_id` → `sinapse_clients`

### `core.whatsapp_department_mappings`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `client_id` | text | tenant |
| `department_id` | uuid | fila FLW |
| `department_label` | text null | rótulo editável (ex. Balcão Pelotas) |
| `city_id` | uuid null | FK → `whatsapp_cities` |
| `status` | enum | `PENDING` \| `MAPPED` |
| `created_at` / `updated_at` | timestamptz | |

Unique: `(client_id, department_id)`  
Regras:

- `MAPPED` exige `city_id` não nulo
- `PENDING` exige `city_id` nulo

### `core.messaging_sessions` (novos campos)

| Field | Type | Notes |
| --- | --- | --- |
| `whatsapp_city_id` | uuid null | FK → `whatsapp_cities`; classificação |
| `external_department_id` | uuid null | `departmentId` FLW; base do update seletivo |

Índices:

- `(client_id, whatsapp_city_id, started_at)`
- `(client_id, external_department_id)`

**Não alterar** o papel de `branch_id` / `branches.flw_department_id` neste design — permanecem para outros usos.

## Flow

### Normalização FLW → canônico

1. Ler `session.departmentId` do payload.
2. Persistir em `external_department_id` (null se ausente).
3. Se `departmentId` ausente: `whatsapp_city_id = null`; **não** criar mapeamento.
4. Se presente: lookup `(client_id, department_id)`.
   - **Não existe** → insert mapeamento `PENDING` (`city_id` null, `department_label` null) → sessão com `whatsapp_city_id = null`.
   - **Existe `MAPPED`** → `whatsapp_city_id = mapping.city_id`.
   - **Existe `PENDING`** → `whatsapp_city_id = null`.

### Edição / criação de mapeamento (POST e PATCH)

**PATCH parcial — omitido ≠ null:**

- Campo **omitido** → não altera esse campo
- `cityId: null` explícito → limpa cidade e força `status = PENDING`
- `status: PENDING` explícito → limpa `city_id` e força `PENDING`
- `cityId` com uuid → força `status = MAPPED` e grava essa cidade
- Rejeitar `status = MAPPED` sem cidade resultante (após merge do PATCH) → 400
- Conflito `{ cityId: "<uuid>", status: "PENDING" }` → 400 (não inferir)

**POST:**

- `{ departmentId, departmentLabel?, cityId? }`
- Com `cityId` → `MAPPED`; sem `cityId` → `PENDING`
- Se `(client_id, department_id)` já existe → **upsert** (mesmas regras; cobre `PENDING` auto-criado). Não retornar 409.

Após persistir o mapeamento, se `city_id` ou `status` mudou em relação ao estado anterior:

1. `UPDATE messaging_sessions` **somente** onde `client_id` e `external_department_id` batem:
   - `MAPPED` → `whatsapp_city_id = city_id`
   - `PENDING` → `whatsapp_city_id = null`
2. Não exige re-normalização `full`.

**Normalização — auto-create `PENDING`:** upsert / tratar unique violation em `(client_id, department_id)` sob corrida (dois workers); não falhar a sessão.

### Seed inicial + backfill

**Escopo:** `client_id` do tenant Ferracosul em uso (resolver no plano via tenant slug / `sinapse_clients` já conhecido no ambiente; seed **nunca** global).

**Passos (ordem fixa):**

1. Upsert das 3 cidades (Pelotas, Rio Grande, Santa Maria) para aquele `client_id`.
2. Upsert dos 17 mapeamentos como `MAPPED` com labels abaixo — `ON CONFLICT (client_id, department_id)` atualiza `city_id`, `department_label`, `status` (cobre linhas `PENDING` criadas antes pelo auto-create).
3. **Backfill de sessões já canônicas** daquele `client_id`:
   - Preencher `external_department_id` a partir de `raw_json->>'departmentId'` (ou caminho equivalente no JSON FLW) quando ainda null.
   - Para cada mapeamento `MAPPED`, `UPDATE whatsapp_city_id` nas sessões com aquele `external_department_id` (mesmo update seletivo do PATCH).
4. Sessões sem `departmentId` no raw permanecem com ambos os campos null.

**Mapeamentos `MAPPED` (seed):**

Pelotas:

- `ace13d85-5f0d-4bf6-b7fb-dad921af0c91` — Balcão Pelotas
- `25208c87-c4c0-4d51-a77e-22a0d1a2bb8f` — Cadastro/Cobrança
- `b1b55081-4158-41c1-bc9f-f76f3e0ca8a4` — Inicio - Pelotas
- `67bc4548-4782-42c6-9b36-013726936cfd` — Pelotas
- `d023765e-1c5d-47a9-bcf3-3b3ac1bef952` — Projetos Corte e Dobra de Vergalhão
- `f8b23ba4-d063-4815-bb10-ec46014f3660` — Vendas Geral - Pelotas
- `52d50f0f-f43f-47d0-bb4a-e2385138e2c2` — Vendas Vidros/Alumínio - Pelotas

Rio Grande:

- `fd7c55e0-2de0-46d1-97e7-6c66ad322d55` — Balcão Rio Grande
- `b3a7857c-0398-4e1b-93bc-777a5edd043c` — Inicio Rio Grande
- `b761de62-753b-4dba-91b5-74541395135f` — Rio Grande
- `42eed417-e10e-4b48-9b2c-6f77468e3ffd` — Vendas Geral - Rio Grande
- `58f26e1b-37a3-4e61-84f0-d96b43c34274` — Vendas Vidros/Alumínio - Rio Grande

Santa Maria:

- `6c0835de-593b-4df6-98fc-9838b2c35ca7` — Balcão Santa Maria
- `5c35e6bf-77f8-4eae-912e-31d1d9261be4` — Inicio Santa Maria
- `032fa04e-6f70-4d2f-ab40-6543683ee543` — Santa Maria
- `d4f4b88a-2342-4da0-8793-7ebfbd94b2f6` — Vendas Geral - Santa Maria
- `da759587-53ac-4c71-969c-08a2236f52f4` — Vendas Vidros/Alumínio - Santa Maria

## APIs

Auth: `TenantScopeGuard` (header `x-tenant-id`), mesmo padrão dos módulos existentes.

### Cidades — `/whatsapp-cities`

| Method | Path | Body / query |
| --- | --- | --- |
| `GET` | `/whatsapp-cities` | lista do tenant (opcional `?activeOnly=true`) |
| `POST` | `/whatsapp-cities` | `{ name }` |
| `PATCH` | `/whatsapp-cities/:id` | `{ name?, isActive? }` |

Delete duro: **não** na v1. Desativar via `isActive=false`. Cidade inativa some do dropdown; vínculos existentes de mapeamento/sessão permanecem.

### Mapeamentos — `/whatsapp-department-mappings`

| Method | Path | Body / query |
| --- | --- | --- |
| `GET` | `/whatsapp-department-mappings` | `?status=PENDING\|MAPPED` |
| `POST` | `/whatsapp-department-mappings` | `{ departmentId, departmentLabel?, cityId? }` → upsert; `MAPPED` se `cityId`; senão `PENDING`; update seletivo se cidade/status mudou |
| `PATCH` | `/whatsapp-department-mappings/:id` | parcial: omitido preserva; `cityId: null` ou `status: PENDING` reclassifica; + update seletivo se mudou |

Não há delete duro de mapeamento na v1; reclassificar ou voltar a `PENDING`.

### KPIs WhatsApp — `/kpis/whatsapp/...`

- Novo query param: `whatsappCityId` (uuid)
- Filtra `messaging_sessions.whatsapp_city_id`
- `branchId` permanece aceito e **continuará ignorado** (comportamento atual)

## Edge cases

- Sessão sem `departmentId` → ambos campos null; sem mapeamento novo
- Mesmo UUID de fila em clients distintos → mapeamentos isolados por `client_id`
- Cidade `is_active=false` → ocultar em listagens de seleção; não quebrar FKs
- PATCH que troca cidade → só sessões com aquele `external_department_id`
- PATCH para `PENDING` → zera `whatsapp_city_id` nas sessões da fila

## Testing

- Normalização: fila mapeada grava cidade; fila nova cria `PENDING` e sessão sem cidade
- PATCH mapeamento: atualiza apenas sessões da fila afetada
- KPI: `whatsappCityId` restringe agregações
- Constraints: unique `(client_id, department_id)`; `MAPPED` sem `city_id` rejeitado

## Non-goals (v1)

- Não substituir nem remover `branches.flw_department_id` / `messaging_sessions.branch_id`
- Não filtrar por tipo de fila (Balcão/Vendas) no KPI — só cidade
- Não implementar UI neste repositório (frontend é outro)
- Não reprocessar `full` automaticamente ao editar mapa
- Não sincronizar catálogo de departamentos da API FLW (só IDs vistos no payload + seed/manual)
