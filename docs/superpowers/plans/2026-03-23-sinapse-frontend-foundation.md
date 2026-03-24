# Sinapse Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real frontend for Sinapse Hub with a split login page, a premium budget KPI dashboard, a polished route transition between them, and a clean Next.js foundation ready for later auth and API integration.

**Architecture:** Add a dedicated Next.js app under `frontend/` using App Router, TypeScript, and Tailwind. Keep the first slice UI-driven with typed local mock data, abstract the post-login redirect so future role checks can route either to the operational dashboard or the admin area, and remove the temporary mockup tooling once the real frontend is in place.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn-inspired UI patterns, Jest or Vitest-compatible frontend tests, npm

---

## Planned File Structure

### Repository Root

- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `README.md`
- Delete: `scripts/mockup-server.cjs`
- Delete: `test/mockup-server.spec.ts`

### Frontend App Bootstrap

- Create: `frontend/package.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/.gitignore`
- Create: `frontend/public/logo/sinapse-hub-logo.png`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `test/frontend-bootstrap.spec.ts`

### Auth Route

- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/app/(auth)/layout.tsx`
- Create: `frontend/src/components/auth/login-shell.tsx`
- Create: `frontend/src/components/auth/login-brand-panel.tsx`
- Create: `frontend/src/components/auth/login-form-panel.tsx`
- Create: `frontend/src/components/auth/login-transition-overlay.tsx`

### Dashboard Route

- Create: `frontend/src/app/(app)/dashboard/page.tsx`
- Create: `frontend/src/app/(app)/layout.tsx`
- Create: `frontend/src/components/dashboard/dashboard-shell.tsx`
- Create: `frontend/src/components/dashboard/dashboard-sidebar.tsx`
- Create: `frontend/src/components/dashboard/dashboard-header.tsx`
- Create: `frontend/src/components/dashboard/kpi-summary-grid.tsx`
- Create: `frontend/src/components/dashboard/kpi-trend-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-breakdown-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-comparison-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-highlight-card.tsx`

### Shared Frontend Modules

- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/lib/auth-flow.ts`
- Create: `frontend/src/lib/design-tokens.ts`
- Create: `frontend/src/lib/mock-budget-data.ts`
- Create: `frontend/src/types/budget-dashboard.ts`

### Frontend Tests

- Create: `frontend/src/lib/auth-flow.spec.ts`
- Create: `frontend/src/lib/design-tokens.spec.ts`
- Create: `frontend/src/lib/mock-budget-data.spec.ts`
- Create: `frontend/src/app/(auth)/login/page.spec.tsx`
- Create: `frontend/src/app/(app)/dashboard/page.spec.tsx`
- Create: `test/mockup-cleanup.spec.ts`

## Scope and Slice Boundary

This plan covers a single cohesive slice:

- the first Next.js frontend app in the repository
- split login screen
- dashboard shell and budget KPI presentation
- animated transition from login to dashboard
- placeholder post-login routing shaped for future role distinction
- cleanup of temporary mockup-only tooling

Out of scope:

- real JWT login
- real tenant selection
- the admin area UI
- live KPI fetching from the Nest backend
- frontend deployment setup

## Task 1: Bootstrap the Next.js Frontend App

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/.gitignore`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/test/setup.ts`
- Create: `test/frontend-bootstrap.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing bootstrap check**

Create a small test or script-level assertion that verifies the frontend app entry exists and exports the expected route structure.

```ts
import { existsSync } from 'node:fs'

describe('frontend bootstrap', () => {
  it('creates the Next.js app entrypoints', () => {
    expect(existsSync('frontend/package.json')).toBe(true)
    expect(existsSync('frontend/src/app/layout.tsx')).toBe(true)
    expect(existsSync('frontend/src/app/page.tsx')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the bootstrap test to verify it fails**

Run: `npm test -- --runInBand test/frontend-bootstrap.spec.ts`
Expected: FAIL because the frontend app does not exist yet.

- [ ] **Step 3: Create the minimal Next.js app**

Requirements:

- use Next.js App Router with TypeScript
- add a root `frontend/package.json` with `dev`, `build`, `start`, and `test` scripts
- wire the frontend test script to a concrete runner such as `vitest`
- add root helper scripts in the main `package.json` such as `frontend:dev`, `frontend:build`, and `frontend:test`
- create a root redirect page in `frontend/src/app/page.tsx` that sends users to `/login`
- keep global styles and config intentionally small

- [ ] **Step 4: Run the bootstrap verification**

Run: `npm test -- --runInBand test/frontend-bootstrap.spec.ts`
Expected: PASS

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json frontend
git commit -m "feat: bootstrap frontend app"
```

## Task 2: Introduce Shared Design Tokens and Basic UI Primitives

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/lib/design-tokens.ts`
- Create: `frontend/src/lib/design-tokens.spec.ts`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Write the failing design token test**

```ts
import { designTokens } from '@/lib/design-tokens'

describe('design tokens', () => {
  it('uses the approved Sinapse palette', () => {
    expect(designTokens.colors.ink).toBe('#16161E')
    expect(designTokens.colors.navy).toBe('#202048')
    expect(designTokens.colors.paper).toBe('#F1EFE8')
  })
})
```

- [ ] **Step 2: Run the design token test to verify it fails**

Run: `npm --prefix frontend run test -- --runInBand src/lib/design-tokens.spec.ts`
Expected: FAIL because the design token module does not exist yet.

- [ ] **Step 3: Add the tokens and primitives**

Requirements:

- store approved palette and layout constants in `design-tokens.ts`
- add reusable `button`, `input`, `card`, and `badge` primitives inspired by shadcn structure
- keep styling aligned with the approved visual language rather than stock defaults
- define CSS variables in `globals.css` so the login and dashboard share the same foundation

- [ ] **Step 4: Run the design token verification**

Run: `npm --prefix frontend run test -- --runInBand src/lib/design-tokens.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui frontend/src/lib frontend/src/app/globals.css
git commit -m "feat: add frontend design tokens and ui primitives"
```

## Task 3: Build the Split Login Experience

**Files:**
- Create: `frontend/src/app/(auth)/layout.tsx`
- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/components/auth/login-shell.tsx`
- Create: `frontend/src/components/auth/login-brand-panel.tsx`
- Create: `frontend/src/components/auth/login-form-panel.tsx`
- Create: `frontend/public/logo/sinapse-hub-logo.png`
- Create: `frontend/src/app/(auth)/login/page.spec.tsx`

- [ ] **Step 1: Write the failing login route test**

```tsx
import { render, screen } from '@testing-library/react'
import LoginPage from './page'

describe('LoginPage', () => {
  it('renders the branded split login shell', () => {
    render(<LoginPage />)

    expect(screen.getByText(/sinapse hub/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the login route test to verify it fails**

Run: `npm --prefix frontend run test -- --runInBand src/app/(auth)/login/page.spec.tsx`
Expected: FAIL because the route and components do not exist yet.

- [ ] **Step 3: Implement the login screen**

Requirements:

- create a split layout with a dark branded left panel and a warm off-white right panel
- use the provided Sinapse Hub logo
- include email/login field, password field, remember-me option, and primary CTA
- add decorative floating KPI cards or visual cues on the left panel
- make the layout stack correctly on smaller screens

- [ ] **Step 4: Run the login route verification**

Run: `npm --prefix frontend run test -- --runInBand src/app/(auth)/login/page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(auth) frontend/src/components/auth frontend/public/logo/sinapse-hub-logo.png
git commit -m "feat: build split branded login page"
```

## Task 4: Add the Post-Login Flow and Transition Contract

**Files:**
- Create: `frontend/src/lib/auth-flow.ts`
- Create: `frontend/src/components/auth/login-transition-overlay.tsx`
- Create: `frontend/src/lib/auth-flow.spec.ts`
- Modify: `frontend/src/components/auth/login-form-panel.tsx`
- Modify: `frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the failing auth flow test**

```ts
import { getPostLoginDestination } from '@/lib/auth-flow'

describe('getPostLoginDestination', () => {
  it('defaults demo users to the dashboard route', () => {
    expect(getPostLoginDestination({ role: 'demo-user' })).toBe('/dashboard')
  })
})
```

- [ ] **Step 2: Run the auth flow test to verify it fails**

Run: `npm --prefix frontend run test -- --runInBand src/lib/auth-flow.spec.ts`
Expected: FAIL because the auth flow helper does not exist yet.

- [ ] **Step 3: Implement the redirect contract and transition**

Requirements:

- create a tiny helper that decides the post-login destination from a role-like input
- default the current flow to `/dashboard`
- leave the helper shaped so a future admin role can route elsewhere without rewriting the page
- add a short loading state and a transition overlay before navigation
- keep the animation subtle: fade, soft blur, and content shift

- [ ] **Step 4: Run the auth flow verification**

Run: `npm --prefix frontend run test -- --runInBand src/lib/auth-flow.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/auth-flow.ts frontend/src/lib/auth-flow.spec.ts frontend/src/components/auth/login-transition-overlay.tsx frontend/src/components/auth/login-form-panel.tsx frontend/src/app/(auth)/login/page.tsx
git commit -m "feat: add login transition and post-login routing contract"
```

## Task 5: Build the Dashboard Shell and Sidebar

**Files:**
- Create: `frontend/src/app/(app)/layout.tsx`
- Create: `frontend/src/app/(app)/dashboard/page.tsx`
- Create: `frontend/src/components/dashboard/dashboard-shell.tsx`
- Create: `frontend/src/components/dashboard/dashboard-sidebar.tsx`
- Create: `frontend/src/components/dashboard/dashboard-header.tsx`
- Create: `frontend/src/app/(app)/dashboard/page.spec.tsx`

- [ ] **Step 1: Write the failing dashboard route test**

```tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from './page'

describe('DashboardPage', () => {
  it('renders the executive dashboard shell', () => {
    render(<DashboardPage />)

    expect(screen.getByText(/orcamentos/i)).toBeInTheDocument()
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the dashboard route test to verify it fails**

Run: `npm --prefix frontend run test -- --runInBand src/app/(app)/dashboard/page.spec.tsx`
Expected: FAIL because the dashboard route does not exist yet.

- [ ] **Step 3: Implement the shell**

Requirements:

- create a dark sidebar with compact Sinapse Hub branding
- include placeholder navigation items, with the dashboard item active
- add a header area with title, support text, and room for KPI filters
- keep the shell responsive so the sidebar can collapse gracefully

- [ ] **Step 4: Run the dashboard shell verification**

Run: `npm --prefix frontend run test -- --runInBand src/app/(app)/dashboard/page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(app) frontend/src/components/dashboard/dashboard-shell.tsx frontend/src/components/dashboard/dashboard-sidebar.tsx frontend/src/components/dashboard/dashboard-header.tsx
git commit -m "feat: add dashboard shell and navigation"
```

## Task 6: Add Typed Budget KPI Mock Data and Dashboard Content Blocks

**Files:**
- Create: `frontend/src/types/budget-dashboard.ts`
- Create: `frontend/src/lib/mock-budget-data.ts`
- Create: `frontend/src/lib/mock-budget-data.spec.ts`
- Create: `frontend/src/components/dashboard/kpi-summary-grid.tsx`
- Create: `frontend/src/components/dashboard/kpi-trend-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-breakdown-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-comparison-card.tsx`
- Create: `frontend/src/components/dashboard/kpi-highlight-card.tsx`
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Write the failing dashboard data test**

```ts
import { budgetDashboardMock } from '@/lib/mock-budget-data'

describe('budget dashboard mock data', () => {
  it('contains the KPI sections needed by the dashboard', () => {
    expect(budgetDashboardMock.summaryCards.length).toBeGreaterThanOrEqual(4)
    expect(budgetDashboardMock.dailyTrend.points.length).toBeGreaterThan(0)
    expect(budgetDashboardMock.statusBreakdown.items.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the dashboard data test to verify it fails**

Run: `npm --prefix frontend run test -- --runInBand src/lib/mock-budget-data.spec.ts`
Expected: FAIL because the data module does not exist yet.

- [ ] **Step 3: Implement the KPI content**

Requirements:

- type the budget dashboard data model
- create local mock data aligned with budget KPIs
- render at least:
  - summary cards
  - daily trend
  - breakdown by status or channel
  - comparison block
  - contextual highlight block
- include loading, empty, or error-ready component structure where practical

- [ ] **Step 4: Run the dashboard data verification**

Run: `npm --prefix frontend run test -- --runInBand src/lib/mock-budget-data.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types frontend/src/lib/mock-budget-data.ts frontend/src/components/dashboard frontend/src/app/(app)/dashboard/page.tsx
git commit -m "feat: add budget kpi dashboard content"
```

## Task 7: Remove Temporary Mockup Tooling and Wire Root Scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`
- Create: `test/mockup-cleanup.spec.ts`
- Delete: `scripts/mockup-server.cjs`
- Delete: `test/mockup-server.spec.ts`

- [ ] **Step 1: Write the failing cleanup check**

Use a focused repository test that asserts the temporary mockup launcher is no longer part of the main workflow.

```ts
import { existsSync } from 'node:fs'

describe('mockup cleanup', () => {
  it('removes the temporary mockup launcher', () => {
    expect(existsSync('scripts/mockup-server.cjs')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the cleanup test to verify it fails**

Run: `npm test -- --runInBand test/mockup-cleanup.spec.ts`
Expected: FAIL because the mockup launcher still exists.

- [ ] **Step 3: Remove the temporary tooling and document the real workflow**

Requirements:

- delete the temporary mockup launcher and its dedicated test
- remove any root script that only exists for the temporary mockup flow
- update `README.md` with the real frontend startup instructions
- keep useful ignore rules only if they still serve the repository

- [ ] **Step 4: Run the cleanup verification**

Run: `npm test -- --runInBand test/mockup-cleanup.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore README.md test/mockup-cleanup.spec.ts
git rm scripts/mockup-server.cjs test/mockup-server.spec.ts
git commit -m "chore: replace temporary mockup workflow with frontend app"
```

## Task 8: Verify the Frontend Slice End-to-End

**Files:**
- Modify: `README.md` if verification uncovered missing instructions

- [ ] **Step 1: Run focused backend tests to ensure no regression from root script changes**

Run: `npm test -- --runInBand test/mockup-cleanup.spec.ts`
Expected: PASS

Run: `npm test -- --runInBand test/frontend-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 2: Run the frontend test suite**

Run: `npm --prefix frontend run test -- --runInBand`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Smoke-test the real frontend locally**

Run: `npm --prefix frontend run dev`

Verify manually:

- `/login` renders the split branded page
- submitting the login shows the transition and routes to `/dashboard`
- `/dashboard` renders the executive budget KPI cockpit
- desktop and mobile widths remain usable

- [ ] **Step 5: Final commit**

```bash
git add README.md package.json .gitignore frontend
git commit -m "feat: add sinapse frontend foundation"
```

## Notes for Execution

- Keep the first slice visually strong, but do not add real authentication yet.
- The post-login destination must remain abstract enough for a future admin redirect.
- Prefer small components with clear boundaries over one giant page file.
- The dashboard is a budget overview cockpit, not a dense analyst workbench.
- Once the real frontend exists, do not keep temporary mockup-only tooling in the main workflow.
