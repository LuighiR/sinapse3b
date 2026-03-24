# Sinapse Live KPI Cockpit Design

Date: 2026-03-24
Project: Sinapse frontend live KPI integration
Status: Approved in conversation

## Goal

Evolve the first frontend slice from a static budget cockpit into a live executive cockpit that consumes real backend KPIs for both budgets and sales, supports a global period filter, and offers KPI-specific drilldown modals.

## Product Intent

The dashboard is no longer just a visual shell. It now becomes the first real operational cockpit for business monitoring.

The user wants:

- live budget KPIs from the existing backend
- live sales KPIs from the existing backend
- a single global period filter that affects the whole dashboard
- KPI groupings by category, especially budgets and sales
- card-level drilldown with a more personalized modal experience

The interface should still preserve the approved premium visual direction:

- dark shell
- warm light workspace
- deep navy accents
- fast executive readability

## Scope

This spec covers:

- replacing mocked dashboard data with live backend integration
- adding sales KPI blocks alongside budget KPIs
- introducing a global period filter with `month` and `range` modes
- propagating that period filter to all dashboard sections and drilldown modals
- adding KPI-specific modals opened from the cards
- reshaping the dashboard so KPIs are grouped by category

This spec does not cover:

- real login authentication
- tenant switching UX
- the admin area
- creating entirely new backend KPI families
- redesigning the login screen

## Existing Backend Assumptions

The user clarified that the backend already supports `from` and `to`, which should be the canonical input contract for the frontend filter system.

The repository already contains backend KPI surfaces for:

- budgets
- sales

Relevant current endpoints include:

- `GET /kpis/budgets/summary`
- `GET /kpis/budgets/daily`
- `GET /kpis/budgets/hourly`
- `GET /kpis/budgets/channel/daily`
- `GET /kpis/budgets/channel/hourly`
- `GET /kpis/budgets/channel/abandonment`
- `GET /kpis/budgets/drilldown`
- `GET /kpis/sales/summary`
- `GET /kpis/sales/daily`
- `GET /kpis/sales/channel/daily`
- `GET /kpis/sales/ticket-average`

This means the frontend should not invent a separate date contract. It should derive `from` and `to` from the selected period mode and pass those values directly to the backend.

## Global Filter Model

The whole dashboard must be driven by one shared period state.

Approved modes:

- `month`
- `range`

### Month mode

The user selects a month and year, for example `January 2026`.

The frontend derives:

- `from = first day of the selected month`
- `to = last day of the selected month`

### Range mode

The user selects exact dates, for example `2026-03-15` to `2026-03-20`.

The frontend derives:

- `from = selected start date`
- `to = selected end date`

### Filter behavior

This state affects:

- budget summary cards
- sales summary cards
- dashboard charts
- grouped KPI sections
- any open drilldown modal

There must be no separate hidden modal-only date state by default. The modal reflects the same selected period as the rest of the cockpit.

## Dashboard Information Architecture

The dashboard should be reorganized into category-based sections rather than one generic KPI grid.

Recommended top-level structure:

1. global header with period controls
2. budget KPI section
3. sales KPI section
4. supporting charts and comparisons

This keeps the experience closer to the examples the user shared, where different KPI families are visually separated and easier to scan.

## Budget KPI Section

The budget category should expose a set of cards derived from the live budget endpoints.

Target cards:

- total budgets
- won budgets
- open budgets
- lost budgets

These are conceptually different cards, but they can still be backed by the same real KPI family with different filters or aggregations.

The user explicitly noted that distinctions such as total, open, won, and lost are likely achieved through filtering. The frontend should therefore centralize the mapping between UI cards and backend filters instead of scattering custom logic per component.

Additional supporting budget blocks can include:

- budgets by day
- budgets by channel and day
- abandonment by channel

These should use the real budget endpoints that already exist in the backend.

## Sales KPI Section

The sales category should expose live cards and charts based on the sales endpoints already present in the repository.

Target first cards:

- total sales
- ticket average
- sales by day and channel

The exact visual composition can remain premium and executive rather than dense, but the data must now be real.

## Modal and Drilldown Behavior

Every major KPI card should support a `Ver mais` action that opens a tailored modal.

The modal should not be a generic dump of raw values. It should feel specific to the selected KPI.

### Example: Budget total modal

When the user opens the total budgets card, the modal should show:

- the consolidated metric for the current period
- daily breakdown for that same selected period
- secondary context when available, such as channel or status

### Example: Sales total modal

When the user opens the total sales card, the modal should show:

- the consolidated sales value for the selected period
- daily evolution
- channel or average-related context when relevant

### Modal principles

- the modal inherits the global period state
- the header must show what period is active
- the body is KPI-specific, not one template blindly reused for all cards
- the visual language should remain premium and calm

## Data Flow

The dashboard should move from local mock data to a thin frontend data layer.

Recommended flow:

1. read global filter state
2. derive `from` and `to`
3. request budget KPI data
4. request sales KPI data
5. transform backend responses into dashboard view models
6. render category sections
7. open drilldown modals using the same filter state plus KPI-specific detail fetches when needed

The transformation layer is important because the backend response shape should not leak directly into every component.

## Frontend State Strategy

The dashboard needs explicit state for:

- current period mode
- selected month and year
- selected range start and end
- active KPI modal
- loading state per KPI family or section
- recoverable error state per section

Recommended interpretation:

- one shared filter state provider or route-level state owner
- server or client data loading can be chosen during planning based on the current Next.js structure
- modal content can fetch additional detail only when the card is opened, but still uses the same global period

## UX Requirements

The period selector should be easy to understand and fast to use.

Recommended UX:

- segmented control between `Mes` and `Range`
- in `Mes`, use month and year selectors
- in `Range`, use start and end date inputs
- visual confirmation of the active period near the section heading or modal title

The whole dashboard should visibly refresh when the period changes.

The cards must remain scannable and premium, but now also behave like entry points into deeper analysis.

## Visual Direction for the Expanded Cockpit

The current palette remains approved:

- `#16161E`
- `#202048`
- warm off-white around `#F1EFE8`

The new KPI categories should feel intentionally grouped:

- section headings for `Orcamentos` and `Vendas`
- cards that visually belong to their category
- supporting charts aligned beneath or beside the correct category

The modals should feel more bespoke than default dialogs:

- soft blur overlay
- generous spacing
- strong title block
- a chart or structured daily list
- subtle motion on open and close

## Technical Direction

The safest implementation direction is:

- keep the login flow as-is for now
- focus changes in the dashboard route and supporting data modules
- add dedicated frontend API helpers for budgets and sales
- build a shared period utility that converts `month` or `range` into backend `from` and `to`
- add modal components specialized by KPI type

The frontend should be able to consume the live backend while preserving the existing room for future role-based routing and later authentication hardening.

## Testing Priorities

The next implementation should add or update tests for:

- period state conversion from `month` and `range` to `from` and `to`
- dashboard rendering with live data adapters
- category section rendering for budgets and sales
- modal opening from key cards
- drilldown content using the currently selected period

It is especially important to test the filter contract because it is now the shared driver of the whole cockpit.

## Success Criteria

This slice is successful when:

- the dashboard no longer depends on the static mock budget dataset for its main KPIs
- budgets and sales both appear as real categories on the same cockpit
- the user can switch between `Mes` and `Range`
- the selected period updates all KPI sections consistently
- clicking a KPI card opens a tailored modal with useful detail
- the design remains coherent with the approved premium Sinapse direction
