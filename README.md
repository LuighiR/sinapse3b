# Sinapse 3 Backend

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and adjust the values for your environment. The sample `DATABASE_URL` targets the PostgreSQL `core` schema with `?schema=core`.

3. Validate the Prisma schema:

   ```bash
   npx prisma validate
   ```

4. Start the app in development:

   ```bash
   npm run dev
   ```

## Environment

The app requires these variables at runtime:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma. For this slice, include `?schema=core` so Prisma targets the `core` PostgreSQL schema.
- `AUTH_JWT_SECRET`: shared secret for JWT signing and verification.
- `AUTH_JWT_ISSUER`: expected JWT issuer value.
- `AUTH_JWT_AUDIENCE`: expected JWT audience value.

Optional values:

- `NODE_ENV`: defaults to `development`.
- `PORT`: defaults to `3000`.

The app validates the environment at bootstrap and fails fast if any required variable is missing or empty.

## Budget KPI Slice

This slice adds the first KPI family for `budgets` on top of the auth and company foundation.

- Raw source: `raw.ferraco_budgets`
- Normalized facts: `core.budget_facts`
- Materialized KPI layer: `kpi.*`

Current budget endpoints:

- `POST /kpis/budgets/refresh?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /kpis/budgets/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&status=Baixado&orderType=Nao%20identificado`
- `GET /kpis/budgets/daily?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&status=Pendente&orderType=Pedido%20Televendas`
- `GET /kpis/budgets/hourly?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&status=Cancelado&orderType=Balcao`
- `GET /kpis/budgets/channel/daily?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&status=Pendente&orderType=Nao%20identificado`
- `GET /kpis/budgets/channel/hourly?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&status=Baixado&orderType=Pedido%20Televendas`
- `GET /kpis/budgets/channel/abandonment?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&orderType=Nao%20identificado`
- `GET /kpis/budgets/drilldown?from=YYYY-MM-DD&to=YYYY-MM-DD&sellerId=123&branchId=5&branchName=Matriz`

Notes:

- All KPI routes require `Authorization: Bearer <jwt>` and `X-Tenant-Id`.
- The API resolves the active `clientId` from the authenticated tenant scope.
- Budget KPIs are refreshed manually in this slice; scheduled jobs come later.
- `status` accepts `Cancelado`, `Baixado`, and `Pendente`.
- `orderType` filters by `order_type`; null/blank channels are exposed as `Nao identificado`.
- Unfiltered `summary` and `daily` can use materialized KPI rows; filtered queries and all hourly/channel cuts read from `core.budget_facts`.
