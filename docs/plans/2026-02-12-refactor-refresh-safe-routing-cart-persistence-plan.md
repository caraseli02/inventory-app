---
title: "refactor: Refresh-safe routing and checkout cart persistence"
type: refactor
date: 2026-02-12
---

# refactor: Refresh-safe routing and checkout cart persistence

## Overview
The app currently uses in-memory view switching in `src/App.tsx` (`useState<ViewState>('home')`). A hard refresh reinitializes React state, so refreshing on Checkout or Inventory drops the user back to mode selection.

This plan introduces URL-based routing (`/`, `/manage`, `/checkout`, `/inventory`) and persists the Checkout cart so that refreshing `/checkout` restores cart contents.

Brainstorm context:
- `docs/brainstorms/2026-02-12-refresh-safe-navigation-brainstorm.md`

## Problem Statement / Motivation
- Operators expect browser refresh to keep them on the current page.
- Deep links (e.g. opening `/checkout`) should work.
- Checkout refresh must restore cart state (items + quantities), not reset.

## Proposed Solution
1. Introduce React Router using `createBrowserRouter` (as documented in `docs/project_architecture_structure.md`).
2. Convert the current “Home tiles” to the `/` route.
3. Route the current pages:
   - `/manage` -> current `src/pages/ScanPage.tsx`
   - `/checkout` -> current `src/pages/CheckoutPage.tsx`
   - `/inventory` -> current `src/pages/InventoryListPage.tsx`
4. Replace `onBack={() => setView('home')}` props with route navigation (home route) or browser back as appropriate.
5. Persist Checkout cart to storage and rehydrate on page load so `/checkout` refresh restores it.
6. Preserve existing `retryLazyImport` / lazy-with-retry behavior for route-level code splitting.
7. Add route-level `errorElement` to improve fault isolation and debugging.

## Local Research Notes (What Exists Today)
- Current view switching is entirely in `src/App.tsx`.
- App bootstraps in `src/main.tsx` (React Query provider already present).
- Routing patterns are documented (not implemented) in:
  - `docs/project_architecture_structure.md`
  - `docs/mvp_code_scaffolding.md`
- Local storage patterns exist (safe try/catch + logging):
  - `src/hooks/useRecentProducts.ts`
  - `src/i18n.ts` (preferred language)

## Technical Considerations
- **Hosting**: browser routing requires SPA fallback so `/checkout` doesn’t 404 on direct load.
  - Vercel config currently has headers only (`vercel.json`), no rewrites.
- **PWA / service worker**: navigation requests should fall back to `index.html` when offline.
  - `vite.config.ts` uses Workbox config; verify/ensure navigation fallback is configured.
- **Cart persistence shape**:
  - `CartItem` includes a serializable `Product` snapshot (`src/types/index.ts`).
  - Prefer persisting a minimal schema with versioning and timestamp to allow future changes.
  - Reset transient fields on restore (e.g. `status`, `statusMessage`, `isCheckingOut`).
- **Cart TTL / size cap**:
  - Add an explicit TTL (expiry) to avoid restoring very old carts by accident.
  - Add a size cap (max items and/or max bytes) to avoid storage blowups and quota errors.
- **Data freshness**:
  - Restored cart may contain stale stock levels/prices if only snapshot is stored.
  - Consider rehydrating with latest product data after load (via `getAllProducts` / React Query cache) while keeping snapshot as offline fallback.

## SpecFlow (User Flows + Edge Cases)
### Happy Paths
- From `/` (mode selection), clicking tiles navigates to the correct routes and updates the URL.
- Visiting `/checkout` directly loads Checkout.
- Refreshing on `/inventory` stays on Inventory.
- Refreshing on `/checkout` stays on Checkout and restores cart (items + quantities).

### Edge Cases
- Stored cart exists but the product is missing (deleted/back-end mismatch): show the item as “unavailable” and allow removing it from cart.
- Multi-tab: last write wins; avoid corrupting storage (write whole document atomically).
- Quota exceeded / storage errors: app should continue to function (cart works in-memory) and log a warning.
- After successful checkout completion: persisted cart is cleared.

## Acceptance Criteria
- [x] App uses URL routes for Home/Manage/Checkout/Inventory.
- [x] Refreshing `/checkout` restores cart items and quantities.
- [x] Refreshing `/inventory` stays on inventory list.
- [x] Landing `/` shows the mode selection tiles (no auto-redirect).
- [x] Direct navigation to `/checkout` and `/inventory` works in production deployment (no 404).
- [x] Checkout completion clears the persisted cart.
- [x] Storage failures do not crash the app.
- [x] E2E coverage exists for refresh behavior.

## Implementation Plan
### Phase 1: Routing Foundation
- [x] Add `react-router-dom` dependency.
- [x] Create router definition (e.g. `src/router.tsx`) using `createBrowserRouter`.
- [x] Update `src/main.tsx` to render `RouterProvider` inside `QueryClientProvider`.
- [x] Refactor `src/App.tsx` into a layout + route components:
  - Extract current “home tiles” UI to a `HomePage` route component (or keep in `App` and render via index route).
  - Keep shared wrappers (ToastProvider, Toaster, header shell) in the layout component.
- [x] Add a catch-all route that redirects to `/` (optional but recommended).
- [x] Preserve `retryLazyImport` behavior:
  - Keep a shared `lazyWithRetry()` helper (can be extracted from `src/App.tsx`) and use it to lazy-load route page components.
- [x] Add route-level `errorElement`:
  - Layout route should have a top-level `errorElement` (to catch loader/action/render errors).
  - Page routes can optionally define their own `errorElement` for more specific messages.

### Phase 2: Update Navigation
- [x] Replace `setView('...')` tile clicks with `Link`/`useNavigate` to the new routes.
- [x] Consider a shared layout-level back/navigation implementation:
  - Option A: Keep per-page `PageHeader` but implement `onBack` via `useNavigate()` (quickest).
  - Option B (preferred if it stays clean): Move header/back behavior to the layout so pages don’t need an `onBack` prop at all.
  - Default back target for these routes is `/` (mode selection), not “last-used mode”.
- [x] Update any internal assumptions/tests that “navigation is state-based”.

### Phase 3: Checkout Cart Persistence
- [x] Define a versioned storage document (example):
  - key: `checkoutCart:v1`
  - value: `{ version: 1, updatedAt: string, expiresAt: string, items: Array<{ product: Product, quantity: number }> }`
- [x] Add TTL + caps:
  - If `Date.now()` is past `expiresAt`, ignore stored cart and clear key.
  - Cap `items.length` (pick a reasonable number, e.g. 200) and drop extras deterministically (oldest first).
  - (Optional) Cap persisted JSON size and skip persistence if it exceeds the cap, logging a warning.
- [x] On every cart change, persist to localStorage with try/catch + logging (follow `src/hooks/useRecentProducts.ts`).
- [x] On Checkout mount, load persisted cart and initialize reducer state.
  - Reset transient UI/status fields on restore.
- [x] On successful checkout completion, clear persisted cart.
- [ ] (Optional but recommended) If `getAllProducts` cache is available, rehydrate stored products with latest data by ID.

### Phase 4: Production Route Fallback
- [x] Add Vercel rewrite rules so any path serves `index.html` (SPA fallback).
- [x] Verify PWA navigation fallback (Workbox) so routes load offline.
- [x] Make `navigateFallback` explicit:
  - Configure Workbox navigation fallback to `index.html` (and a denylist for API/assets) so offline refresh on `/checkout` works reliably.

### Phase 5: Tests
- [x] Update existing Playwright navigation tests to assert real URLs (`/inventory`, `/checkout`).
- [x] Add a Playwright test that:
  - seeds `checkoutCart:v1` in localStorage
  - visits `/checkout`
  - reloads the page
  - asserts cart items are still visible
- [x] Add a Playwright test that reloads `/inventory` and asserts URL remains `/inventory`.
- [x] Add unit tests for cart storage encode/decode (schema versioning, invalid JSON handling).
- [x] Address pre-commit hook ordering (reduce wasted runtime / flakiness):
  - Current hook runs `CI=true pnpm test:e2e` before `pnpm validate-docs` (`package.json`).
  - Update ordering so cheap deterministic checks run first (recommended: `pnpm validate-docs && CI=true pnpm test:e2e`).
  - If E2E remains too heavy for pre-commit, consider moving it to CI-only (team decision).

## Success Metrics
- Refresh on `/checkout` no longer returns users to mode selection.
- Reduced operator friction (qualitative): “refresh is safe” feedback.
- Fewer navigation-related bug reports.

## Dependencies & Risks
- Introducing routing is a structural refactor; expect small regressions in navigation and tests.
- Production deployment must support SPA fallback; otherwise deep links will 404.
- Persisting large product snapshots could hit storage limits; keep schema minimal and consider TTL.

## References & Research
Internal references:
- Current view state: `src/App.tsx`
- App bootstrap: `src/main.tsx`
- Checkout cart state: `src/pages/CheckoutPage.tsx`
- Inventory page: `src/pages/InventoryListPage.tsx`
- Router guidance: `docs/project_architecture_structure.md`
- Router scaffold: `docs/mvp_code_scaffolding.md`
- LocalStorage patterns: `src/hooks/useRecentProducts.ts`, `src/i18n.ts`
- Deployment headers (and missing rewrites): `vercel.json`
- PWA Workbox config: `vite.config.ts`
