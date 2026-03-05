---
status: complete
priority: p2
issue_id: "071"
tags: [code-review, testing, e2e, playwright, orders, ux]
dependencies: []
---

# Add E2E coverage for Orders Option B (desktop buttons + mobile swipe)

## Problem Statement

The Orders page now has device-conditional behaviors:
- Desktop/tablet: inline Confirm/Reject buttons
- Mobile: swipe-to-reveal Confirm/Reject with an expanded fallback

Without automated coverage, this is prone to regressions (breakpoints, pointer events, touch-action behavior, and mutation wiring).

## Findings

- Mobile swipe interaction is implemented with pointer events and direct transform writes in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`.
- Desktop inline actions are visible only on `sm`+ in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`.
- There’s no explicit automated test validating:
  - the buttons appear/disappear at correct breakpoints
  - swipe reveals actions
  - clicking actions triggers expected network calls + UI updates

## Proposed Solutions

### Option 1: Playwright E2E with network interception (recommended)

**Approach:**
- Add a Playwright spec for Orders page.
- Use `page.route()` to stub `GET /api/orders` (or the actual endpoint used by `getOrders`) and return fixture orders.
- Stub confirm/cancel endpoints to return updated status.
- For mobile viewport:
  - set viewport to e.g. iPhone 13
  - simulate swipe using mouse/touch actions (`page.mouse.down/move/up` or `page.touchscreen`)
  - assert action buttons become visible and work
- For desktop viewport:
  - verify inline buttons exist for pending orders and work.

**Pros:**
- High confidence in real interactions (pointer events + layout)
- Prevents breakpoint regressions

**Cons:**
- Requires some plumbing for stable fixtures/mocking

**Effort:** Medium

**Risk:** Low

---

### Option 2: Component/unit tests (React Testing Library)

**Approach:** Add unit tests for `OrderCard` with pointer events and style assertions.

**Pros:**
- Faster and more deterministic than E2E

**Cons:**
- Harder to validate true swipe/scroll behavior vs browser reality

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented Option 1: Playwright E2E spec with network interception for Supabase REST calls used by `orders-api`.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:110`
- Playwright specs under `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/tests/`

## Resources

- Existing Playwright setup: `playwright.config.ts`

## Acceptance Criteria

- [x] Desktop test: Confirm/Reject buttons are visible for pending orders and trigger expected mutation flow
- [x] Mobile test: swipe reveals actions; tapping Confirm/Reject triggers expected mutation flow
- [x] Tests run in CI/stable locally with fixtures (Supabase calls intercepted)

## Work Log

### 2026-03-05 - Initial Discovery

**By:** Codex

**Actions:**
- Identified new device-conditional behavior in Orders UI
- Noted lack of automated coverage for gestures/breakpoints
- Drafted Playwright-first test plan with network stubbing

**Learnings:**
- Gesture-driven UX benefits significantly from real-browser E2E validation

### 2026-03-05 - E2E tests added

**By:** Codex

**Actions:**
- Added `tests/e2e/orders-option-b.spec.ts` covering:
  - desktop inline actions visibility + confirm flow
  - mobile swipe-to-reveal reject flow
  - mobile Actions sheet (non-gesture fallback) confirm flow
- Added stable `data-testid` hooks to `OrderCard` for reliable selectors.
- Stubbed Supabase REST/auth calls via `page.route()` (CORS + preflight support) so tests don't require real Supabase connectivity.

**Files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/tests/e2e/orders-option-b.spec.ts`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`

**Learnings:**
- Cross-origin Supabase requests require handling `OPTIONS` preflight + `access-control-allow-origin` in test stubs.
