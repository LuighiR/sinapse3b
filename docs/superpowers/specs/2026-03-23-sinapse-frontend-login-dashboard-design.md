# Sinapse Frontend Login and Budget Dashboard Design

Date: 2026-03-23
Project: Sinapse frontend foundation
Status: Approved in conversation

## Goal

Build the first real frontend for Sinapse Hub with two user-facing surfaces:

- a premium login experience with the Sinapse Hub brand
- an executive dashboard focused on budget KPIs

This slice is intended to let the team start integrating and visually validating the product while the backend continues to evolve.

## Product Context

The existing repository currently contains the NestJS backend and KPI endpoints. The frontend does not exist yet and must be added to the same repository as a new Next.js application.

This first slice should prioritize:

- visual quality close to the shared references
- a reusable foundation that can grow into the actual product
- clean separation between login flow and authenticated app shell
- a clear path to later API integration without rewriting the UI foundation

## Scope

This spec covers one cohesive frontend slice:

- Next.js application setup inside this repository
- login route
- dashboard route
- animated transition between login success and dashboard entry
- static or mocked budget KPI data shaped for later API integration
- removal of the temporary brainstorming mockup assets once the real frontend exists

This spec does not cover:

- real authentication implementation
- real role-based authorization
- the future admin area implementation
- non-budget KPI families
- production deployment infrastructure

## Architecture Decision

Use a dedicated Next.js frontend app inside the current repository, instead of a static prototype or a separate repository.

Reasons:

- it creates a real application shell that can grow into production
- route structure and component boundaries can be designed correctly from the start
- the login and dashboard can be integrated incrementally without discarding early work
- Next.js is a better long-term match than a temporary static mockup for auth, routing, and app growth

Approved implementation direction:

- create a `frontend/` app inside the repository
- use App Router
- use TypeScript
- use Tailwind CSS
- use components inspired by shadcn patterns, adapted to the Sinapse visual identity

## Brand and Visual Direction

The frontend should feel premium, calm, and product-focused rather than flashy or generic.

Approved palette anchors:

- `#16161E` as the main dark base
- `#202048` as the deep blue accent/base
- a warm off-white instead of a pure white, near `#F1EFE8`

The Sinapse Hub logo provided by the user is now part of the approved visual identity and should appear prominently in the login area and in a more compact form inside the dashboard shell.

Visual principles:

- dark shell plus light workspace contrast
- rounded containers with a premium B2B feel
- minimal but intentional motion
- dashboards should feel clean and fast to read
- login should feel branded and atmospheric, not just utilitarian

## Application Structure

The first slice should use two main route groups:

- `/(auth)/login`
- `/(app)/dashboard`

The routes remain separate for clarity and maintainability, but the perceived transition between them should feel polished and intentional.

Recommended initial layout structure:

- auth layout for login pages
- app layout for authenticated pages
- shared design tokens and UI primitives in the frontend app

## Login Experience

The login page should use a split layout inspired by the approved reference.

### Left panel

Purpose:

- establish the Sinapse Hub brand
- create a premium first impression
- hint at KPI and business intelligence value

Approved characteristics:

- dark background using `#16161E` and `#202048`
- subtle atmospheric gradients or glows
- Sinapse Hub logo in a prominent position
- strong welcome heading
- supporting product statement
- decorative KPI mini-cards or metric-inspired floating elements

The left panel is presentational in this first slice and does not need to expose real navigation or real data.

### Right panel

Purpose:

- hold the actual login interaction
- keep the form crisp, readable, and professional

Approved characteristics:

- warm off-white background
- concise headline
- email/login and password fields
- remember-me option
- primary sign-in button
- optional support copy such as password recovery, terms, or policy links if they help the realism of the screen

### Login behavior

This first slice can use a visual/demo login flow instead of real backend authentication.

Approved initial behavior:

- submitting the form transitions the user to the dashboard
- use a short loading state to make the transition feel intentional
- no hard dependency on backend auth is required yet

## Future Role Distinction

The user explicitly clarified that the same login entry point will later serve both:

- the normal product/dashboard area
- a separate administrative area

This distinction is not implemented now, but the design must preserve the concept.

Implications for the first slice:

- do not hardcode assumptions that the login only ever leads to one app experience
- keep the post-login routing decision abstract enough that future role checks can redirect either to dashboard or admin
- avoid naming that permanently couples login to the dashboard only

Recommended initial interpretation:

- current demo flow routes to the dashboard by default
- future auth logic can replace that single destination with a role-based redirect step

## Transition Design

The user requested a polished transition while keeping route separation.

Approved transition direction:

- after sign-in, show a short intermediate loading state
- the login surface should fade and soften
- brand elements can slightly scale or blur during exit
- the dashboard should enter with a subtle slide/fade
- KPI cards should appear with a staggered reveal

The motion should be elegant and short, not theatrical. The intent is to make the route change feel premium without sacrificing clarity.

## Dashboard Experience

The first authenticated screen is the budget KPI cockpit.

Approved direction:

- executive overview rather than dense analyst tooling
- close to the chosen “cockpit executivo limpo” direction
- sidebar dark, main workspace light
- strong visual hierarchy and quick scanning

### Dashboard shell

The shell should include:

- dark sidebar
- top header area
- main KPI grid

The sidebar can initially contain:

- compact Sinapse Hub branding
- primary navigation placeholders
- active state for the dashboard item
- user/profile placeholder at the bottom if it strengthens the realism

Only the dashboard route needs to be truly functional now. Other navigation items can be presentational.

### Header area

The header should communicate:

- page title
- short supporting text or period context
- quick actions or a subtle status indicator if useful

This slice should also leave room for filters relevant to budget KPIs, such as:

- period range
- seller
- status
- order type

The initial implementation can use UI placeholders or local-state filters without wiring real API queries yet.

### KPI content blocks

The dashboard should include a balanced executive composition, not just a list of cards.

Recommended sections:

- top KPI summary cards
- daily trend chart
- breakdown by status or channel
- comparative block by seller, branch, or another business dimension
- one contextual insight or highlight block to avoid a purely mechanical layout

The initial KPI content should reflect the existing budget backend domain so later integration is straightforward.

## Data Strategy

The first slice should use typed local mock data that resembles the backend response shapes closely enough to support later integration.

Reasons:

- frontend layout can progress independently
- data contracts can be introduced intentionally
- empty/loading/error states can be designed before live data arrives

Recommended approach:

- create typed mock datasets for the budget dashboard
- isolate mock data from presentational components
- structure chart and card props so live fetches can replace mocks later with minimal churn

## State and UX Requirements

Even in a mocked slice, the dashboard should anticipate real-world states.

Important initial states:

- login idle
- login submitting/loading
- dashboard initial enter transition
- KPI card normal state
- KPI card loading placeholder
- KPI section empty state
- KPI section recoverable error state

The first delivery does not need complete backend error handling, but the component structure should make those states natural to add and preview.

## Responsiveness

Primary target for the first slice:

- desktop
- notebook/laptop screens

Secondary but required support:

- mobile layout that remains usable and visually coherent

Interpretation:

- the dashboard may collapse the sidebar on smaller screens
- card grid and login split layout must stack correctly on narrower widths
- no element should rely on fixed desktop-only dimensions

## Component and Boundary Guidance

The Next.js app should be organized around clear UI responsibilities.

Recommended boundary types:

- layouts
- route-level pages
- reusable shell/navigation pieces
- auth-specific components
- dashboard-specific KPI components
- shared UI primitives and tokens
- typed mock data modules

Avoid:

- giant page files with all markup inline
- tightly coupling demo data to rendering logic
- introducing role logic, data fetching complexity, or admin abstractions earlier than needed

## Testing Priorities

This frontend slice should introduce a testable structure, even if visual work is the primary focus.

Priority test coverage:

- route-level rendering for login and dashboard
- post-login navigation behavior
- presence of key KPI sections on the dashboard
- at least one regression check for the mocked route transition or sign-in flow

The exact testing library can be finalized during implementation planning, but the plan should keep tests small and meaningful.

## Removal of Temporary Mockups

The temporary brainstorming mockup flow is no longer part of the desired workflow once the real frontend app exists.

Implementation should remove:

- the temporary mockup launcher and related mockup-only files that are no longer needed
- obsolete HTML mockup artifacts that would confuse future contributors

Only keep files that continue to provide real value to the frontend workflow.

## Risks and Follow-Up

Known follow-up items after this slice:

- connect login flow to real authentication
- implement role-based redirect from shared login to dashboard or admin area
- integrate real KPI API data
- define the shared contract between frontend auth state and backend tenant selection
- expand the dashboard beyond mocked budget KPIs

## Success Criteria

This slice is successful when:

- the repository contains a working Next.js frontend app
- the login page matches the approved split visual direction
- the dashboard matches the approved executive budget cockpit direction
- login transitions smoothly into the dashboard
- the Sinapse Hub brand is represented clearly
- the structure is ready for later auth branching to admin versus operational experiences
