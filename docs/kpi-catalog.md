# Catalogo de KPIs do Sinapse 3

## Objetivo

Este documento descreve, para cada KPI exposto hoje pelo backend:

- de onde o dado sai
- se ele passa por normalizacao
- se ele e salvo em alguma tabela `facts`
- se ele e materializado nas tabelas `kpi.*`
- o que exatamente o KPI representa
- observacoes tecnicas importantes encontradas no codigo

## Visao geral da arquitetura

Hoje o projeto trabalha com quatro familias de KPI:

- `budgets`
- `sales`
- `calls`
- `whatsapp`

O fluxo geral e:

1. tabelas brutas em `raw.*`
2. normalizacao para tabelas canonicas/facts em `core.*`
3. materializacao opcional em `kpi.snapshots` e `kpi.breakdowns`
4. leitura pela API, com fallback para `facts` quando necessario

## Camadas de dados

| Camada | Tabelas principais | Papel |
| --- | --- | --- |
| Bruto | `raw.ferraco_budgets`, `raw.ferraco_sales`, `raw.ferraco_calls` | Recebe os dados originais da operacao |
| Canonica / facts | `core.budget_facts`, `core.sale_facts`, `core.call_facts` | Guarda os registros normalizados e prontos para analise |
| Canonica WhatsApp | `core.sessions`, `core.messages`, `core.tickets`, `core.contacts`, `core.tags`, `core.contact_tags` | Base analitica usada direto pelos KPIs de WhatsApp |
| Catalogo de KPI | `kpi.definitions`, `kpi.availability`, `kpi.calculation_runs` | Define KPIs, disponibilidade e execucoes de refresh |
| Materializacao | `kpi.snapshots`, `kpi.breakdowns` | Guarda agregacoes prontas para leitura |
| Auditoria de drilldown | `kpi.drilldown_refs` | Estrutura de referencia para drilldown; hoje o uso pratico esta mais forte em budgets |

## Tabelas compartilhadas de KPI

### `kpi.definitions`

Catalogo dos KPIs materializados. Cada definicao tem:

- `code`: codigo tecnico, por exemplo `budgets.summary`
- `family`: familia (`budgets`, `sales`, `calls`)
- `granularity`: `summary`, `daily`, `hourly`, `ranking`, `drilldown`

### `kpi.availability`

Marca se um KPI materializado esta disponivel para um `client_id` e quando ele ficou disponivel.

### `kpi.calculation_runs`

Historico de refresh:

- periodo processado
- status (`RUNNING`, `COMPLETED`, `FAILED`)
- quantidade lida
- quantidade escrita
- metadados

### `kpi.snapshots`

Materializacao de metricas agregadas de resumo.

Exemplos:

- `budgets.summary`
- `sales.summary`
- `calls.summary`

### `kpi.breakdowns`

Materializacao de series e quebras por dimensao.

Exemplos:

- serie diaria
- serie horaria
- ranking por agente
- quebra por vendedor

## Familia `budgets`

### Pipeline

Fonte original:

- `raw.ferraco_budgets`

Normalizacao:

- `BudgetNormalizationService`

Tabela facts:

- `core.budget_facts`

Status normalizado:

- `Baixado` -> `WON`
- `Fechado` -> `WON`
- `Pendente` -> `OPEN`
- `Cancelado` -> `LOST`
- qualquer outro valor -> `UNKNOWN`

Campos importantes em `core.budget_facts`:

- `budget_date`: data do orcamento
- `budget_datetime`: data/hora de abertura
- `closing_date`
- `cancellation_date`
- `cancelation_time`
- `seller_id`, `seller_name`
- `branch_id`, `branch_name`
- `channel` (vem de `raw.ferraco_budgets.order_type`)
- `status_normalized`
- `value_amount`
- `sequential_linked_sale`
- `payload_json`

### KPIs e endpoints

| KPI / endpoint | O que representa | Fonte principal | Salvo em `core.budget_facts`? | Salvo em `kpi.*`? | Como a API responde |
| --- | --- | --- | --- | --- | --- |
| `POST /kpis/budgets/refresh` | Reprocessa budgets do periodo | `raw.ferraco_budgets` | Sim | Sim | Normaliza e materializa |
| `GET /kpis/budgets/summary` | Cards total/open/won/lost por quantidade e valor | `core.budget_facts` | Sim | Sim, em `kpi.snapshots` (`budgets.summary`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/budgets/daily` | Serie diaria de quantidade e valor | `core.budget_facts` | Sim | Sim, em `kpi.breakdowns` (`budgets.daily`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/budgets/hourly` | Serie por hora de quantidade e valor | `core.budget_facts` | Sim | Nao | Sempre calcula on demand em `facts` |
| `GET /kpis/budgets/channel/daily` | Quebra diaria por canal/order type | `core.budget_facts` | Sim | Nao | Sempre calcula on demand em `facts` |
| `GET /kpis/budgets/channel/hourly` | Quebra horaria por canal/order type | `core.budget_facts` | Sim | Nao | Sempre calcula on demand em `facts` |
| `GET /kpis/budgets/channel/abandonment` | Cancelamentos por canal | `core.budget_facts` | Sim | Nao | Sempre calcula on demand em `facts` |
| `GET /kpis/budgets/drilldown` | Lista auditavel de orcamentos do periodo | `core.budget_facts` | Sim | Existe materializacao `budgets.drilldown`, mas a rota atual le os facts | Sempre usa facts |
| `GET /kpis/budgets/follow-up/summary` | Follow-up ate 24h vs apos 24h, separado em converted/lost/open | `core.budget_facts` + classificador | Sim | Nao | Sempre calcula on demand |
| `GET /kpis/budgets/follow-up/daily` | Serie diaria do follow-up | `core.budget_facts` + classificador | Sim | Nao | Sempre calcula on demand |
| `GET /kpis/budgets/follow-up/drilldown` | Drilldown auditavel do follow-up por registro | `core.budget_facts` + classificador | Sim | Nao | Sempre calcula on demand |
| `POST /kpis/budgets/follow-up/dkw-dispatch` | Acao operacional de disparo para DKW | `core.budget_facts` + `raw.ferraco_budgets.sent_dkw_at` | Sim | Nao | Nao e KPI, e uma automacao operacional |

### Metricas materializadas de `budgets`

#### `budgets.summary` em `kpi.snapshots`

Metricas gravadas:

- `total.count`
- `total.value`
- `open.count`
- `open.value`
- `won.count`
- `won.value`
- `lost.count`
- `lost.value`

Semantica:

- `total`: todos os orcamentos do periodo
- `open`: somente `status_normalized = OPEN`
- `won`: somente `status_normalized = WON`
- `lost`: somente `status_normalized = LOST`
- `count`: quantidade de registros
- `value`: soma de `value_amount`

#### `budgets.daily` em `kpi.breakdowns`

Dimensao:

- `dimension_type = DAY`

Metricas gravadas por dia:

- `count`
- `value`

Semantica:

- bucket diario pelo campo `budget_date`

#### `budgets.drilldown` em `kpi.breakdowns`

Dimensao:

- `dimension_type = SELLER`

Metricas gravadas por vendedor:

- `count`
- `value`

Semantica:

- agregado por `seller_id` / `seller_name`

Observacao importante:

- a materializacao `budgets.drilldown` existe e e escrita no refresh, mas a rota publica `GET /kpis/budgets/drilldown` hoje consulta `core.budget_facts` diretamente

### KPIs calculados on demand em `budgets`

#### Summary e daily com filtros

Quando a consulta tem qualquer um destes filtros:

- `branchId`
- `sellerId`
- `status`
- `orderType`

a API ignora a materializacao e recalcula em cima de `core.budget_facts`.

#### Hourly

Formula:

- bucket por hora usando `budget_datetime`
- `count`: numero de budgets abertos naquela hora
- `value`: soma de `value_amount` naquela hora

#### Channel daily / hourly

Formula:

- agrupamento por `channel`
- quando `channel` estiver vazio ou nulo, a API devolve `Nao identificado`

#### Channel abandonment

Formula:

- mesma base de `core.budget_facts`
- aplica filtro equivalente a `status = Cancelado` -> `status_normalized = LOST`
- agrupa por `channel`

Interpretacao:

- mede os budgets perdidos/cancelados por canal no periodo

#### Follow-up summary / daily / drilldown

Base:

- `core.budget_facts`

Campos usados para classificar:

- `status_normalized`
- `budget_datetime`
- `closing_date`
- `cancellation_date`
- `cancelation_time`
- `payload_json` para fallback de `closing_time` e `cancelation_time`

Regras:

- `converted`: budget `WON`
- `lost`: budget `LOST`
- `open`: budget ainda aberto em `referenceAt`
- `within24h`: diferenca entre abertura e fechamento/cancelamento/referencia menor ou igual a 24h
- `after24h`: diferenca maior que 24h

Importante:

- a classificacao considera o estado do registro em `referenceAt`, nao apenas o estado atual
- se o budget fechou depois de `referenceAt`, naquela consulta ele conta como `open`
- se o horario de fechamento/cancelamento nao existir, o sistema cai para o fim do dia correspondente

Interpretacao:

- estes endpoints medem velocidade de tratamento do budget apos a abertura
- o `percentage` do follow-up e participacao sobre o total geral analisado, nao sobre a propria janela

## Familia `sales`

### Pipeline

Fonte original:

- `raw.ferraco_sales`

Normalizacao:

- `SaleNormalizationService`

Tabela facts:

- `core.sale_facts`

Status normalizado:

- `N` -> `VALID`
- `S` -> `CANCELED`
- qualquer outro valor -> `UNKNOWN`

Como o canal e derivado:

- a normalizacao procura um budget ligado por `sale.sequential = budget_facts.sequential_linked_sale`
- quando encontra, copia `budget.channel` para `sale_facts.channel`
- quando nao encontra, o canal fica nulo e a API devolve `Nao identificado`

Campos importantes em `core.sale_facts`:

- `sale_date`
- `sale_datetime`
- `seller_id`, `seller_name`
- `branch_id`, `branch_name`
- `status_normalized`
- `channel`
- `has_linked_budget`
- `linked_budget_source_record_id`
- `value_amount`
- `sequential`
- `invoice_serie`
- `invoice_numeric`
- `list_davs_id`

### KPIs e endpoints

| KPI / endpoint | O que representa | Fonte principal | Salvo em `core.sale_facts`? | Salvo em `kpi.*`? | Como a API responde |
| --- | --- | --- | --- | --- | --- |
| `POST /kpis/sales/refresh` | Reprocessa vendas do periodo | `raw.ferraco_sales` | Sim | Sim | Normaliza e materializa |
| `GET /kpis/sales/summary` | Cards total/active/canceled + media diaria + ticket medio | `core.sale_facts` | Sim | Sim, em `kpi.snapshots` (`sales.summary`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/sales/daily` | Serie diaria de quantidade e valor | `core.sale_facts` | Sim | Sim, em `kpi.breakdowns` (`sales.daily`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/sales/channel/daily` | Quebra diaria por canal | `core.sale_facts` | Sim | Nao | Sempre calcula on demand |
| `GET /kpis/sales/ticket-average` | Ticket medio geral e por canal | `core.sale_facts` | Sim | Nao | Sempre calcula on demand |
| `GET /kpis/sales/drilldown` | Lista auditavel de vendas do periodo | `core.sale_facts` | Sim | Nao | Sempre usa facts |

### Metricas materializadas de `sales`

#### `sales.summary` em `kpi.snapshots`

Metricas gravadas:

- `total.count`
- `total.value`
- `active.count`
- `active.value`
- `canceled.count`
- `canceled.value`
- `average_daily.count`
- `average_daily.value`
- `average_ticket.value`

Semantica:

- `total`: todas as vendas filtradas pelo periodo
- `active`: `status_normalized = VALID`
- `canceled`: `status_normalized = CANCELED`
- `average_daily.count`: `quantidade total / numero de dias do periodo`
- `average_daily.value`: `valor total / numero de dias do periodo`
- `average_ticket.value`: `valor total / quantidade total`

#### `sales.daily` em `kpi.breakdowns`

Dimensao:

- `dimension_type = DAY`

Metricas gravadas por dia:

- `count`
- `value`

Semantica:

- bucket diario pelo campo `sale_date`

### KPIs calculados on demand em `sales`

#### Summary e daily com filtros

Quando houver qualquer um destes filtros:

- `branchId`
- `sellerId`
- `status`
- `orderType`
- `hasLinkedBudget`

a API recalcula o resultado em cima de `core.sale_facts`.

#### Channel daily

Formula:

- agrupa por `sale_date` + `channel`
- quando `channel` estiver vazio ou nulo, a API devolve `Nao identificado`

#### Ticket average

Formula:

- `overall.count`: quantidade de vendas no recorte filtrado
- `overall.value`: soma de `value_amount`
- `overall.averageTicket`: `overall.value / overall.count`
- `channels[*].averageTicket`: `soma do canal / quantidade do canal`

Observacao importante:

- pela implementacao atual, se o usuario nao enviar `status`, o calculo usa todas as vendas filtradas, incluindo `VALID` e `CANCELED`
- o exemplo do `rest-api.md` para `ticket-average` parece refletir apenas vendas ativas; isso nao bate exatamente com a regra implementada hoje

#### Drilldown

Base:

- `core.sale_facts`

Uso:

- auditoria detalhada
- filtros por `branchId`, `sellerId`, `status`, `orderType`, `hasLinkedBudget`

Interpretacao de `hasLinkedBudget`:

- `true`: a venda conseguiu ser ligada a algum budget pela chave de sequencial
- `false`: a venda nao encontrou budget relacionado

## Familia `calls`

### Pipeline

Fonte original:

- `raw.ferraco_calls`

Normalizacao:

- `CallNormalizationService`

Tabela facts:

- `core.call_facts`

Importacao e ownership:

- `raw.ferraco_calls.domain_uuid` casa com `core.branches.telephony_domain_uuid`
- `core.branches.client_id` define o cliente/tenant backend da chamada
- `core.sinapse_clients` continua representando o cliente backend, nao cada filial

Regras principais de normalizacao:

- so entra como chamada inbound para a empresa quando `direction = inbound`
- `status` bruto da central e persistido em `core.call_facts.status`
- `is_received = true` quando inbound com `status = answered` e nao for fila-only
- `is_lost = true` quando inbound com `status` em `missed`, `no_answer` ou `no_answered`
- excecao de fila: inbound com `status = answered`, sem `extension_uuid` e destino com exatamente `3` digitos vira `is_received = false`, `is_lost = true` e sem atribuicao de atendente
- `lostWithoutEmployee` / `withoutEmployee`: inclui perdas de fila (inbound, `extension_uuid` vazio, ramal de 3 digitos) mesmo com Employee de mesmo `extensionNumber`; exclusao por `extensionUuid` de Employee continua valendo
- destino com `4+` digitos sem `extension_uuid` e `status = answered` continua como recebida
- `agent_resolution_type` e `agent_resolution_key` ajudam a resolver o agente mesmo em chamadas perdidas (exceto fila-only answered)

Campos importantes em `core.call_facts`:

- `domain_uuid`: dominio original vindo de `raw.ferraco_calls`
- `branch_id`: filial dona do dominio de telefonia, resolvida na normalizacao
- `started_at`
- `ended_at`
- `duration_seconds`
- `is_inbound_to_company`
- `is_received`
- `is_lost`
- `extension_uuid`
- `agent_resolution_type`
- `agent_resolution_key`
- `agent_extension_number`

### KPIs e endpoints

| KPI / endpoint | O que representa | Fonte principal | Salvo em `core.call_facts`? | Salvo em `kpi.*`? | Como a API responde |
| --- | --- | --- | --- | --- | --- |
| `POST /kpis/calls/refresh` | Reprocessa ligacoes do periodo | `raw.ferraco_calls` | Sim | Sim | Normaliza e materializa |
| `GET /kpis/calls/summary` | Recebidas, perdidas, total inbound, budgets abertos de televendas e pico horario | `core.call_facts` + `core.budget_facts` | Sim | Sim, em `kpi.snapshots` (`calls.summary`) | Usa materializacao sem filtros; com filtros cai para `facts`. Com atendente, `totalInbound`/`peakHour` ignoram o atendente e `received`/`lost` respeitam |
| `GET /kpis/calls/hourly` | Serie horaria de recebidas, perdidas e inbound total | `core.call_facts` | Sim | Sim, em `kpi.breakdowns` (`calls.hourly`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/calls/agents/ranking` | Ranking por atendente/ramal | `core.call_facts` + `core.employees` | Sim | Sim, em `kpi.breakdowns` (`calls.agent_ranking`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/calls/hourly/comparison` | Comparativo por hora entre chamadas e budgets de televendas | `core.call_facts` + `core.budget_facts` | Sim | Sim, em `kpi.breakdowns` (`calls.hourly_comparison`) | Usa materializacao sem filtros; com filtros cai para `facts` |
| `GET /kpis/calls/drilldown` | Relatorio completo paginado de ligacoes | `core.call_facts` | Sim | Nao | Sempre consulta `facts` com filtros e paginacao server-side |
| `GET /kpis/calls/filter-options` | Valores distintos de `status` e `direction` | `core.call_facts` | Sim | Nao | Distinct por periodo/filial do tenant |

### Metricas materializadas de `calls`

#### `calls.summary` em `kpi.snapshots`

Metricas gravadas:

- `received.count`
- `lost.count`
- `total_inbound.count`
- `telemarketing_open_budgets.count`
- `peak_hour.count` com `dimensionsJson.hour`

Semantica:

- `received.count`: quantidade de chamadas inbound recebidas
- `lost.count`: quantidade de chamadas inbound perdidas
- `total_inbound.count`: total de chamadas inbound validas
- `telemarketing_open_budgets.count`: quantidade de budgets de canal `Pedido Televendas` com status `OPEN` no periodo
- `peak_hour.count`: maior volume horario de `total_inbound.count`

#### `calls.hourly` em `kpi.breakdowns`

Dimensao:

- `dimension_type = HOUR`

Metricas por hora:

- `received.count`
- `lost.count`
- `total_inbound.count`

#### `calls.agent_ranking` em `kpi.breakdowns`

Dimensao:

- `dimension_type = AGENT`

Metricas por agente:

- `received.count`
- `lost.count`
- `total_inbound.count`

Como o agente e resolvido:

- primeiro tenta casar por `extension_uuid` com `core.employees`
- quando nao consegue, cai para `agent_extension_number` / `agent_resolution_key`
- se houver funcionario resolvido, o agente sai como `EMPLOYEE`
- senao, sai como `EXTENSION`

#### `calls.hourly_comparison` em `kpi.breakdowns`

Dimensao:

- `dimension_type = HOUR`

Metricas por hora:

- `received.count`
- `lost.count`
- `telemarketing_budget.count`

Semantica:

- `telemarketing_budget.count` conta budgets do canal `Pedido Televendas` naquele horario, sem ligar individualmente budget com ligacao

### Filtros e comportamento especial

Filtros disponiveis:

- `employeeId` (preferencial)
- `extensionUuid`
- `extensionNumber`
- `branchId`
- no drilldown tambem: `status`, `direction`, `callerNumber`, `destinationNumber`, `durationMin`, `durationMax`, `outcome`, `page`, `pageSize`

Impacto:

- qualquer filtro faz a API recalcular em cima de `core.call_facts`
- no summary, filtro de atendente nao reduz `totalInbound` nem `peakHour`

Detalhe importante:

- `extensionNumber` tambem permite capturar chamadas perdidas sem `extension_uuid`, desde que o ramal resolvido bata com `agent_extension_number` ou `agent_resolution_key`
- `outcome` no drilldown mapeia `ANSWERED`/`UNANSWERED`/`UNCLASSIFIED` a partir de `is_received`/`is_lost`

Filtro por filial:

- e fact-native: usa `core.call_facts.branch_id`
- o lookup de `core.employees` por `extension_uuid` ou ramal fica apenas para nomes e agent labels

### Backfill e rollout de `calls`

Antes de rodar refresh de chamadas em producao:

- popular `core.branches.telephony_domain_uuid` para todas as filiais
- reprocessar intervalos historicos afetados depois do deploy
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

## Familia `whatsapp`

### Pipeline

Diferente das outras familias, `whatsapp` hoje nao usa refresh nem tabelas `facts` dedicadas.

Fonte principal:

- `core.sessions`
- `core.messages`
- `core.tickets`
- `core.contacts`
- `core.tags`
- `core.contact_tags`
- apoio de `core.employees` e `core.branches` para filtros e ranking

Conclusao importante:

- os KPIs de WhatsApp sao consultas diretas nas tabelas canonicas
- nao existem hoje `core.whatsapp_facts`, `kpi.snapshots` nem `kpi.breakdowns` para essa familia

### KPIs e endpoints

| KPI / endpoint | O que representa | Fonte principal | Salvo em facts? | Salvo em `kpi.*`? | Como a API responde |
| --- | --- | --- | --- | --- | --- |
| `GET /kpis/whatsapp/summary` | Total de conversas e mensagens recebidas | `core.sessions`, `core.messages`, `core.tickets` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/agents/ranking` | Ranking de atendentes por sessoes | `core.sessions`, `core.employees`, `core.branches` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/sessions/hourly` | Serie horaria de sessoes criadas | `core.sessions`, `core.tickets` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/sessions/daily` | Serie diaria de sessoes criadas | `core.sessions`, `core.tickets` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/messages/hourly` | Serie horaria de mensagens recebidas | `core.messages`, `core.sessions`, `core.tickets` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/messages/daily` | Serie diaria de mensagens recebidas | `core.messages`, `core.sessions`, `core.tickets` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/tags` | Catalogo de tags disponiveis | `core.tags` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/tags/hourly` | Serie horaria de sessoes associadas a uma tag | `core.sessions`, `core.tickets`, `core.contact_tags` | Nao | Nao | Consulta direta |
| `GET /kpis/whatsapp/tags/hourly/comparison` | Comparativo entre sessoes com tag e budgets abertos por hora | `core.sessions`, `core.contact_tags`, `core.budget_facts` | Parcial: usa `budget_facts` para a metade de budgets | Nao | Consulta direta |

### Semantica de cada KPI de WhatsApp

#### Summary

- `totalConversations.count`: quantidade de registros em `core.sessions` no periodo
- `receivedMessages.count`: quantidade de mensagens em `core.messages` com:
  - `from_me = false`
  - `sender_type = HUMAN`

#### Agents ranking

Base:

- agrupa sessoes por `assigned_user_name` / `assigned_user_email`
- tenta casar `assigned_user_email` com `core.employees.chat_id`

Interpretacao:

- mede volume de sessoes por atendente
- quando nao ha atendente resolvido, cai para `Nao atribuido`

#### Sessions hourly / daily

Base:

- `core.sessions.started_at`

Interpretacao:

- quantidade de conversas iniciadas

#### Messages hourly / daily

Base:

- `core.messages.created_at_external`

Regras:

- considera apenas mensagens recebidas do humano

Interpretacao:

- volume de mensagens recebidas, nao volume de sessoes

#### Tags / tags hourly

Base:

- `core.contact_tags`
- link com `core.tickets.contact_id`
- link com `core.sessions.ticket_id`

Interpretacao:

- mede sessoes cujos contatos carregam a tag informada

#### Tags hourly comparison

Tem duas metades:

- `tagSessionsCount`: sessoes da tag no horario
- `openBudgetsCount`: budgets `OPEN` em `core.budget_facts` no mesmo horario

Importante:

- e um comparativo temporal, nao uma ligacao 1:1 entre conversa e budget

### Filtros e comportamento especial

Filtros disponiveis em varias rotas:

- `chatId`
- `branchId`
- `tagId`
- `sellerId` apenas no comparativo de tag com budgets

Detalhes:

- `chatId` compara com `core.sessions.assigned_user_email`, case-insensitive
- `branchId` nao filtra sessao por campo proprio; ele deriva o filtro via `core.employees.chat_id` dentro da filial
- quando o match do `chat_id` na filial for ambiguo ou inexistente, o registro nao entra no resultado filtrado
- no comparativo por tag, `sellerId` afeta apenas `openBudgetsCount`, porque esse lado da consulta vem de `core.budget_facts`

## Resumo rapido por familia

| Familia | Tabela bruta | Facts | Materializacao `kpi.*` | Observacao principal |
| --- | --- | --- | --- | --- |
| `budgets` | `raw.ferraco_budgets` | `core.budget_facts` | Sim | Summary e daily sao materializados; follow-up e canais sao on demand |
| `sales` | `raw.ferraco_sales` | `core.sale_facts` | Sim | Summary e daily sao materializados; ticket medio e canais sao on demand |
| `calls` | `raw.ferraco_calls` | `core.call_facts` | Sim | Importa por `branches.telephony_domain_uuid` e filtra filial por `call_facts.branch_id` |
| `whatsapp` | Nao usa `raw.*` neste modulo | Nao ha facts dedicados | Nao | Tudo e lido direto das tabelas canonicas `core.*` |

## Pontos de atencao encontrados no codigo

1. `budgets.drilldown` e materializado no refresh, mas o endpoint publico de drilldown hoje le `core.budget_facts` diretamente.
2. `sales/ticket-average` hoje usa o conjunto filtrado de `sale_facts`; se o usuario nao mandar `status`, o calculo inclui vendas ativas e canceladas.
3. Os KPIs de `whatsapp` sao live query. Nao ha hoje refresh, `availability`, `snapshots` ou `breakdowns` especificos dessa familia.
4. Em `calls`, o KPI `telemarketingOpenBudgets` e o comparativo horario dependem de `core.budget_facts`, nao de alguma tabela de calls.
5. Em `calls`, o filtro por filial usa `core.call_facts.branch_id`; resolucao por ramal/funcionario fica para rotulos de agente.
6. Em `budgets/follow-up`, horarios ausentes de fechamento ou cancelamento caem para o fim do dia, o que pode alterar a classificacao entre `within24h` e `after24h`.

