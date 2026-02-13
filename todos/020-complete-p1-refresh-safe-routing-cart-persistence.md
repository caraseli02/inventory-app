---
status: complete
priority: p1
issue_id: "020"
tags: [navigation, routing, checkout, pwa]
dependencies: []
---

# Refresh-safe routing + checkout cart persistence

## Problem Statement
Refreshing the app on Checkout or Inventory List resets in-memory view state and drops operators back to mode selection. This breaks expected browser behavior and wastes time.

## Findings
- Navigation is currently controlled by local `view` state in `src/App.tsx`.
- Hard refresh reinitializes React state, so `view` resets to `'home'`.
- Checkout cart state is held in a `useReducer` in `src/pages/CheckoutPage.tsx` and is not persisted.

## Proposed Solutions
- Option A (chosen): URL-based routing (`/`, `/manage`, `/checkout`, `/inventory`) + persist checkout cart with TTL/caps.
- Option B: Persist only `view` + cart in storage (no real routes). Smaller change, worse back/forward/deep link.

## Recommended Action
Implement the plan in `docs/plans/2026-02-12-refactor-refresh-safe-routing-cart-persistence-plan.md`.

## Acceptance Criteria
- [x] App uses URL routes for Home/Manage/Checkout/Inventory.
- [x] Refreshing `/checkout` restores cart items and quantities.
- [x] Refreshing `/inventory` stays on inventory list.
- [x] Landing `/` shows the mode selection tiles.
- [x] Direct navigation to `/checkout` and `/inventory` works in production (no 404).
- [x] Checkout completion clears the persisted cart.
- [x] Storage failures do not crash the app.
- [x] E2E coverage exists for refresh behavior.

## Work Log
### 2026-02-12 - Branch + Work Start

**By:** Codex

**Actions:**
- Created branch `codex/refresh-safe-routing-cart-persistence`.
- Created this todo and will execute the plan.

**Learnings:**
- Repo is in detached HEAD by default in this worktree; must branch before work.

### 2026-02-12 - Implemented Routing + Persistence

**By:** Codex

**Actions:**
- Added React Router routes: `/`, `/manage`, `/checkout`, `/inventory`.
- Preserved lazy chunk retry behavior via `src/lib/lazyWithRetry.ts`.
- Added route `errorElement` (`src/routes/RootRouteError.tsx`).
- Persisted checkout cart with TTL + caps (`src/lib/checkoutCartStorage.ts`) and hydration in `src/pages/CheckoutPage.tsx`.
- Added Vercel SPA rewrites (`vercel.json`) and Workbox `navigateFallback` (`vite.config.ts`).
- Updated Playwright tests + added refresh tests (`tests/e2e/refresh-routing.spec.ts`).
- Adjusted Playwright webServer port to avoid reusing an unrelated dev server (`playwright.config.ts`).

**Tests:**
- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
- `pnpm test:e2e`
