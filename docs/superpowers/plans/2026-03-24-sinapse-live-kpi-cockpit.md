# Sinapse Live KPI Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked dashboard with a live executive cockpit that reads real budget and sales KPIs, applies a shared date and seller filter across the whole screen, and opens KPI-specific drilldown modals.

**Architecture:** Keep the existing Next.js app structure, but introduce a dedicated live dashboard data layer with a shared filter contract. The dashboard route will fetch from the existing Nest endpoints for budgets, sales, and employees, translate those responses into UI-specific view models, and use one shared filter state for cards, charts, and modals. Until real login is integrated, backend auth headers should come from frontend environment variables.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library, NestJS KPI APIs

---

## Planned File Structure

### Frontend Environment and API Bridge

- Modify: `frontend/package.json`
- Modify: `README.md`
- Create: `frontend/.env.example`
- Create: `frontend/src/lib/frontend-env.ts`
- Create: `frontend/src/lib/frontend-env.spec.ts`
- Create: `frontend/src/lib/api/sinapse-api.ts`

### Dashboard Filter and Data Contracts

- Create: `frontend/src/types/dashboard-filters.ts`
- Create: `frontend/src/types/live-kpi-dashboard.ts`
- Create: `frontend/src/lib/dashboard-filters.ts`
- Create: `frontend/src/lib/dashboard-filters.spec.ts`
- Create: `frontend/src/lib/dashboard-kpi-definitions.ts`
- Create: `frontend/src/lib/dashboard-kpi-definitions.spec.ts`
- Create: `frontend/src/lib/dashboard-live-data.ts`
- Create: `frontend/src/lib/dashboard-live-data.spec.ts`

### Dashboard UI

- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/app/(app)/dashboard/page.spec.tsx`
- Modify: `frontend/src/components/dashboard/dashboard-header.tsx`
- Modify: `frontend/src/components/dashboard/kpi-summary-grid.tsx`
- Modify: `frontend/src/types/budget-dashboard.ts`
- Create: `frontend/src/components/dashboard/dashboard-filter-bar.tsx`
- Create: `frontend/src/components/dashboard/dashboard-category-section.tsx`
- Create: `frontend/src/components/dashboard/kpi-stat-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-detail-modal.tsx`
- Create: `frontend/src/components/dashboard/kpi-modal-daily-list.tsx`
- Create: `frontend/src/components/dashboard/kpi-modal-chart.tsx`
- Create: `frontend/src/components/dashboard/kpi-detail-modal.spec.tsx`

### Optional Mock Cleanup

- Delete or stop using: `frontend/src/lib/mock-budget-data.ts`
- Delete or stop using: `frontend/src/lib/mock-budget-data.spec.ts`

## Scope and Slice Boundary

This plan covers one cohesive slice:

- live budget KPIs
- live sales KPIs
- global date filter with `Mes` and `Range`
- optional global seller filter
- KPI grouping by category
- KPI-specific modals
- temporary frontend backend-auth bridge through env vars

Out of scope:

- real login authentication
- tenant selection UX
- admin area
- new backend KPI endpoints beyond the ones already present
- deep redesign of the login route

## Task 1: Add a Frontend Backend-Auth Bridge for Live KPI Fetching

**Files:**
- Create: `frontend/.env.example`
- Create: `frontend/src/lib/frontend-env.ts`
- Create: `frontend/src/lib/frontend-env.spec.ts`
- Create: `frontend/src/lib/api/sinapse-api.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing frontend env test**

```ts
import { getFrontendEnv } from "@/lib/frontend-env";

describe("getFrontendEnv", () => {
  it("reads the backend base url and dev auth headers", () => {
    const env = getFrontendEnv({
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_DEV_JWT: "token",
      NEXT_PUBLIC_DEV_TENANT_ID: "tenant-1",
    });

    expect(env.apiBaseUrl).toBe("http://localhost:3000");
    expect(env.devJwt).toBe("token");
    expect(env.devTenantId).toBe("tenant-1");
  });
});
```

- [ ] **Step 2: Run the env test to verify it fails**

Run: `npm --prefix frontend run test -- src/lib/frontend-env.spec.ts`
Expected: FAIL because the frontend env helper does not exist yet.

- [ ] **Step 3: Implement the env and API client**

Requirements:

- define frontend env vars for:
  - backend base url
  - temporary JWT
  - temporary tenant id
- build a tiny API helper that:
  - prefixes all requests with the configured backend base url
  - sends `Authorization: Bearer <jwt>`
  - sends `X-Tenant-Id`
  - serializes query params safely
- keep the helper reusable for budgets, sales, and employees

- [ ] **Step 4: Run the env verification**

Run: `npm --prefix frontend run test -- src/lib/frontend-env.spec.ts`
Expected: PASS

- [ ] **Step 5: Document the live dashboard env contract**

Update `README.md` and `frontend/.env.example` with the exact variables needed to connect the frontend to the live backend.

- [ ] **Step 6: Commit**

```bash
git add frontend/.env.example frontend/src/lib/frontend-env.ts frontend/src/lib/frontend-env.spec.ts frontend/src/lib/api/sinapse-api.ts README.md
git commit -m "feat: add frontend backend auth bridge"
```

## Task 2: Introduce Shared Dashboard Filter and KPI Definition Contracts

**Files:**
- Create: `frontend/src/types/dashboard-filters.ts`
- Create: `frontend/src/types/live-kpi-dashboard.ts`
- Create: `frontend/src/lib/dashboard-filters.ts`
- Create: `frontend/src/lib/dashboard-filters.spec.ts`
- Create: `frontend/src/lib/dashboard-kpi-definitions.ts`
- Create: `frontend/src/lib/dashboard-kpi-definitions.spec.ts`

- [ ] **Step 1: Write the failing dashboard filter test**

```ts
import { buildDashboardQueryPeriod } from "@/lib/dashboard-filters";

describe("buildDashboardQueryPeriod", () => {
  it("converts month mode into backend from/to", () => {
    expect(
      buildDashboardQueryPeriod({
        mode: "month",
        month: 1,
        year: 2026,
      }),
    ).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("keeps exact dates in range mode", () => {
    expect(
      buildDashboardQueryPeriod({
        mode: "range",
        from: "2026-03-15",
        to: "2026-03-20",
      }),
    ).toEqual({
      from: "2026-03-15",
      to: "2026-03-20",
    });
  });
});
```

- [ ] **Step 2: Run the filter test to verify it fails**

Run: `npm --prefix frontend run test -- src/lib/dashboard-filters.spec.ts`
Expected: FAIL because the dashboard filter helper does not exist yet.

- [ ] **Step 3: Write the failing KPI definition test**

```ts
import { getBudgetCardQuery, getSalesCardQuery } from "@/lib/dashboard-kpi-definitions";

describe("dashboard kpi definitions", () => {
  it("maps the canceled sales card to the correct sales status filter", () => {
    expect(getSalesCardQuery("canceled-sales")).toMatchObject({
      status: "Cancelada",
    });
  });

  it("maps the won budgets card to the correct budget status filter", () => {
    expect(getBudgetCardQuery("won-budgets")).toMatchObject({
      status: "Baixado",
    });
  });
});
```

- [ ] **Step 4: Run the KPI definition test to verify it fails**

Run: `npm --prefix frontend run test -- src/lib/dashboard-kpi-definitions.spec.ts`
Expected: FAIL because the KPI definition helper does not exist yet.

- [ ] **Step 5: Implement the shared contracts**

Requirements:

- define the global filter state with:
  - `mode`
  - `month`
  - `year`
  - `from`
  - `to`
  - `sellerId`
- create a helper that derives backend `from` and `to`
- create centralized card-definition helpers for:
  - total budgets
  - won budgets
  - open budgets
  - lost budgets
  - total sales
  - canceled sales
  - ticket average
- keep status-based definitions out of the global filter state

- [ ] **Step 6: Run the contract verifications**

Run: `npm --prefix frontend run test -- src/lib/dashboard-filters.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run test -- src/lib/dashboard-kpi-definitions.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/dashboard-filters.ts frontend/src/types/live-kpi-dashboard.ts frontend/src/lib/dashboard-filters.ts frontend/src/lib/dashboard-filters.spec.ts frontend/src/lib/dashboard-kpi-definitions.ts frontend/src/lib/dashboard-kpi-definitions.spec.ts
git commit -m "feat: add live dashboard filter and kpi contracts"
```

## Task 3: Build Live Dashboard Adapters for Budgets, Sales, and Sellers

**Files:**
- Create: `frontend/src/lib/dashboard-live-data.ts`
- Create: `frontend/src/lib/dashboard-live-data.spec.ts`
- Create: `frontend/src/types/live-kpi-dashboard.ts`
- Modify: `frontend/src/types/budget-dashboard.ts`

- [ ] **Step 1: Write the failing live data adapter test**

```ts
import { buildLiveDashboardViewModel } from "@/lib/dashboard-live-data";

describe("buildLiveDashboardViewModel", () => {
  it("creates separate budget and sales sections from live api responses", () => {
    const viewModel = buildLiveDashboardViewModel({
      budgetsSummary: {
        total: { count: 15500, value: "1862861.2300" },
        won: { count: 12000, value: "1652861.2300" },
        open: { count: 500, value: "10000.0000" },
        lost: { count: 3000, value: "10514.5800" },
      },
      salesSummary: {
        total: { count: 12500, value: "1655861.2300" },
        canceled: { count: 350, value: "15420.1000" },
        averageTicket: { value: "140.5000" },
      },
    });

    expect(viewModel.budgetCards.length).toBeGreaterThanOrEqual(4);
    expect(viewModel.salesCards.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the live data adapter test to verify it fails**

Run: `npm --prefix frontend run test -- src/lib/dashboard-live-data.spec.ts`
Expected: FAIL because the live adapter does not exist yet.

- [ ] **Step 3: Implement the live dashboard adapter**

Requirements:

- fetch or shape data for:
  - budget summary
  - budget daily
  - budget channel daily
  - budget abandonment
  - sales summary
  - sales daily
  - sales channel daily
  - sales ticket average
  - employees for seller selector
- convert backend response shapes into a single UI view model
- include category sections:
  - `Orcamentos`
  - `Vendas`
- preserve both count and money value where relevant
- keep formatting logic isolated from React components

- [ ] **Step 4: Run the live adapter verification**

Run: `npm --prefix frontend run test -- src/lib/dashboard-live-data.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/dashboard-live-data.ts frontend/src/lib/dashboard-live-data.spec.ts frontend/src/types/live-kpi-dashboard.ts frontend/src/types/budget-dashboard.ts
git commit -m "feat: add live dashboard data adapters"
```

## Task 4: Replace the Dashboard Header Placeholders with Global Date and Seller Controls

**Files:**
- Modify: `frontend/src/components/dashboard/dashboard-header.tsx`
- Create: `frontend/src/components/dashboard/dashboard-filter-bar.tsx`
- Modify: `frontend/src/app/(app)/dashboard/page.spec.tsx`

- [ ] **Step 1: Write the failing dashboard header test**

```tsx
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

describe("DashboardPage filters", () => {
  it("renders the global month/range and seller filters", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/mes/i)).toBeInTheDocument();
    expect(screen.getByText(/range/i)).toBeInTheDocument();
    expect(screen.getByText(/seller/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dashboard header test to verify it fails**

Run: `npm --prefix frontend run test -- src/app/(app)/dashboard/page.spec.tsx`
Expected: FAIL because the new filters are not rendered yet.

- [ ] **Step 3: Implement the shared filter controls**

Requirements:

- replace placeholder buttons with:
  - month/range toggle
  - month selector
  - year selector
  - range start and end inputs
  - seller selector
- render only the controls relevant to the active date mode
- keep the layout premium and compact
- make the selected state visually obvious

- [ ] **Step 4: Run the header verification**

Run: `npm --prefix frontend run test -- src/app/(app)/dashboard/page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/dashboard-header.tsx frontend/src/components/dashboard/dashboard-filter-bar.tsx frontend/src/app/(app)/dashboard/page.spec.tsx
git commit -m "feat: add global dashboard date and seller filters"
```

## Task 5: Replace the Mocked Dashboard with Live Budget and Sales Sections

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/components/dashboard/kpi-summary-grid.tsx`
- Create: `frontend/src/components/dashboard/dashboard-category-section.tsx`
- Create: `frontend/src/components/dashboard/kpi-stat-card.tsx`
- Delete or stop using: `frontend/src/lib/mock-budget-data.ts`
- Delete or stop using: `frontend/src/lib/mock-budget-data.spec.ts`

- [ ] **Step 1: Write the failing live dashboard page test**

```tsx
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

describe("DashboardPage live cockpit", () => {
  it("renders separate Orcamentos and Vendas sections", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/orcamentos/i)).toBeInTheDocument();
    expect(screen.getByText(/vendas/i)).toBeInTheDocument();
    expect(screen.getByText(/orcamento total/i)).toBeInTheDocument();
    expect(screen.getByText(/vendas totais/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dashboard page test to verify it fails**

Run: `npm --prefix frontend run test -- src/app/(app)/dashboard/page.spec.tsx`
Expected: FAIL because the page still uses the old mock-only layout.

- [ ] **Step 3: Implement the live cockpit sections**

Requirements:

- replace the single generic KPI grid with:
  - a budget section
  - a sales section
- show budget cards for:
  - total
  - won
  - open
  - lost
- show sales cards for:
  - total
  - canceled
  - ticket average
- keep supporting charts aligned under the right category
- maintain the premium executive layout
- remove or stop relying on `budgetDashboardMock`

- [ ] **Step 4: Run the live cockpit verification**

Run: `npm --prefix frontend run test -- src/app/(app)/dashboard/page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(app)/dashboard/page.tsx frontend/src/components/dashboard/kpi-summary-grid.tsx frontend/src/components/dashboard/dashboard-category-section.tsx frontend/src/components/dashboard/kpi-stat-card.tsx frontend/src/lib/mock-budget-data.ts frontend/src/lib/mock-budget-data.spec.ts
git commit -m "feat: replace mocked dashboard with live budget and sales cockpit"
```

## Task 6: Add KPI-Specific Detail Modals with Daily Breakdowns

**Files:**
- Create: `frontend/src/components/dashboard/kpi-detail-modal.tsx`
- Create: `frontend/src/components/dashboard/kpi-modal-daily-list.tsx`
- Create: `frontend/src/components/dashboard/kpi-modal-chart.tsx`
- Create: `frontend/src/components/dashboard/kpi-detail-modal.spec.tsx`
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Write the failing KPI modal test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import DashboardPage from "./page";

describe("KPI detail modal", () => {
  it("opens a tailored modal when the total budget card is selected", async () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: /ver mais/i }));

    expect(await screen.findByText(/orcamento total/i)).toBeInTheDocument();
    expect(screen.getByText(/periodo ativo/i)).toBeInTheDocument();
    expect(screen.getByText(/por dia/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the KPI modal test to verify it fails**

Run: `npm --prefix frontend run test -- src/components/dashboard/kpi-detail-modal.spec.tsx`
Expected: FAIL because no modal exists yet.

- [ ] **Step 3: Implement the KPI modal system**

Requirements:

- open a modal from each main card
- tailor the modal content to the selected KPI
- show:
  - title
  - active period
  - active seller context when selected
  - consolidated count/value
  - daily breakdown
- support:
  - total budgets modal
  - won budgets modal
  - open budgets modal
  - lost budgets modal
  - total sales modal
  - canceled sales modal
  - ticket average modal
- keep the modal linked to the global date and seller filters

- [ ] **Step 4: Run the KPI modal verification**

Run: `npm --prefix frontend run test -- src/components/dashboard/kpi-detail-modal.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/kpi-detail-modal.tsx frontend/src/components/dashboard/kpi-modal-daily-list.tsx frontend/src/components/dashboard/kpi-modal-chart.tsx frontend/src/components/dashboard/kpi-detail-modal.spec.tsx frontend/src/app/(app)/dashboard/page.tsx
git commit -m "feat: add kpi-specific drilldown modals"
```

## Task 7: Verify the Live Cockpit End-to-End

**Files:**
- Modify: `README.md` if verification reveals missing setup or env instructions

- [ ] **Step 1: Run the focused frontend tests**

Run: `npm --prefix frontend run test -- src/lib/frontend-env.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run test -- src/lib/dashboard-filters.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run test -- src/lib/dashboard-kpi-definitions.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run test -- src/lib/dashboard-live-data.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run test -- src/components/dashboard/kpi-detail-modal.spec.tsx`
Expected: PASS

Run: `npm --prefix frontend run test -- src/app/(app)/dashboard/page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run the full frontend suite**

Run: `npm --prefix frontend run test`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Smoke-test the live cockpit locally**

Run: `npm run frontend:dev`

Verify manually:

- `http://localhost:3001/dashboard` loads with live data
- changing `Mes` updates all budget and sales cards
- changing `Range` updates all budget and sales cards
- changing `seller` updates all sections consistently
- opening a KPI modal preserves the current period and seller
- total, won, open, lost, active, and canceled cards reflect the intended KPI definitions

- [ ] **Step 5: Commit**

```bash
git add README.md frontend
git commit -m "feat: add live budget and sales kpi cockpit"
```

## Notes for Execution

- Do not touch the current login flow beyond what is strictly necessary for the dashboard handoff.
- Do not add global status filters to the dashboard.
- Budget and sales status cuts must be encoded as KPI definitions, not shared filter state.
- Use `GET /companies/current/employees` to populate the seller selector instead of hardcoding sellers.
- The backend currently requires `Authorization` and `X-Tenant-Id`; until real auth exists, use frontend env variables to supply them.
- Do not overwrite or revert unrelated backend sales work already present in the repository.
