---
module: OrdersPage
date: 2026-03-05
problem_type: ui_bug
component: page_component
symptoms:
  - "Confirm/reject actions were not equally fast across desktop and mobile"
  - "Mobile relied on gesture/expand patterns that reduced discoverability and accessibility"
  - "No automated coverage for breakpoint + gesture interactions"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [orders, option-b, swipe-reveal, bottom-sheet, playwright-e2e]
related_github_issue: null
commit: null
---

# Problem Description

The Orders page needed a faster, lower-friction workflow for operators to **confirm** or **reject** pending pickup orders across desktop, tablet, and mobile.

The desired UX pattern was **Option B**:
- Desktop/tablet: visible Confirm/Reject buttons per order.
- Mobile: swipe-to-reveal actions, with a **non-gesture fallback** for accessibility/discoverability.

# Symptoms

- On desktop, operators wanted one-click Confirm/Reject without expanding cards.
- On mobile, swipe-only (or “expand first”) patterns were easy to miss and slower under load.
- Regressions were likely because there was no E2E test coverage for breakpoint + pointer/gesture behavior.

# Root Cause Analysis

This was primarily a UX/state orchestration issue: the action affordances and interaction model were not aligned with how operators work across breakpoints (mouse vs touch), and the interaction states (swipe open/closed, expanded/collapsed) were not covered by automated tests.

# Solution

Implemented Option B in a production-ready way:

1) **Desktop/tablet inline actions**
- Pending orders show visible `Confirm` / `Reject` buttons in the card header.

2) **Mobile swipe-to-reveal actions**
- Pending orders support swipe-to-reveal Confirm/Reject via pointer events + transform.
- Swipe logic is encapsulated in a dedicated hook for maintainability.

3) **Mobile non-gesture fallback**
- Added an always-visible “Actions” trigger (kebab) that opens a bottom sheet with Confirm/Reject.

4) **E2E coverage**
- Added Playwright tests with network interception for Supabase REST/auth calls so tests run without real Supabase connectivity.

```tsx
// ✅ AFTER: stable hooks and explicit affordances for tests + UX
<div data-testid="order-card" data-order-id={order.id}>
  {/* desktop buttons */ }
  <Button data-testid="order-confirm-desktop">Confirm</Button>
  <Button data-testid="order-reject-desktop">Reject</Button>
  {/* mobile non-gesture fallback */ }
  <Button data-testid="order-actions-trigger" aria-label={`Actions for ${order.order_number}`} />
</div>
```

# Files Changed

- `src/pages/OrdersPage.tsx`
- `src/pages/orders/OrderCard.tsx`
- `src/hooks/useSwipeReveal.ts`
- `src/hooks/useMediaQuery.ts`
- `tests/e2e/orders-option-b.spec.ts`

# Prevention

- [x] Add Playwright E2E coverage for desktop + mobile interactions (including swipe + sheet fallback).
- [x] Use stable `data-testid` hooks for gesture-driven UI to avoid selector brittleness.
- [ ] Consider adding a small “busy operator” manual QA checklist for release notes (mobile swipe, sheet actions, and desktop buttons).

