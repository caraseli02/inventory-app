---
status: complete
priority: p3
issue_id: "072"
tags: [code-review, refactor, react, orders, quality]
dependencies: []
---

# Refactor Orders swipe-to-reveal logic into a reusable hook

## Problem Statement

`OrderCard` contains a substantial amount of pointer-event + transform logic for swipe-to-reveal actions. It works, but it’s harder to reason about and evolve (threshold tuning, velocity, rubber-banding, accessibility enhancements, “close on outside tap”, etc.).

Refactoring this into a dedicated hook would improve maintainability and reduce future bug risk.

## Findings

- Swipe state machine and pointer handlers live inline in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:78`–`:174`.
- Direct DOM manipulation is appropriate for perf, but the coupling makes it hard to add features like:
  - velocity-aware fling
  - resistance/rubber-banding
  - single-open-card coordination
  - programmatic close when list scrolls

## Proposed Solutions

### Option 1: Extract `useSwipeReveal` hook (recommended)

**Approach:**
- Create a hook `useSwipeReveal({ enabled, maxPx, isOpen, onOpenChange })`.
- Return:
  - `ref` for swipeable node
  - props for pointer handlers
  - `close()` helper
- Keep DOM writes inside the hook to isolate concerns.

**Pros:**
- Cleaner `OrderCard` component
- Easier to test and iterate
- Enables reuse in other list items

**Cons:**
- Slight upfront refactor cost

**Effort:** 2–4 hours

**Risk:** Low

---

### Option 2: Keep inline logic, add comments + thresholds constants

**Approach:** Minimal cleanup: group constants, document gesture constraints, and extract small helpers.

**Pros:**
- Lowest effort

**Cons:**
- Still harder to reuse/extend

**Effort:** 30–60 minutes

**Risk:** Low

## Recommended Action

Implemented Option 1: extracted swipe-to-reveal pointer logic into a reusable `useSwipeReveal` hook.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:78`

## Acceptance Criteria

- [x] `OrderCard` readability improves (gesture code encapsulated)
- [x] Behavior remains unchanged (manual QA + E2E coverage added separately)
- [x] Hook API is small and composable

## Work Log

### 2026-03-05 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed swipe implementation complexity
- Identified likely iteration points (thresholds, velocity, close behavior)
- Drafted extraction plan into a reusable hook

**Learnings:**
- Isolating gesture logic is a leverage point for long-term UX iteration

### 2026-03-05 - Hook extracted

**By:** Codex

**Actions:**
- Added `useSwipeReveal` hook to encapsulate pointer tracking, cancellation on vertical scroll, and open/close thresholding.
- Updated `OrderCard` to consume the hook and keep UI logic focused on rendering.

**Files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/hooks/useSwipeReveal.ts`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`

**Learnings:**
- Keeping DOM transform writes inside the hook makes future tuning (thresholds/velocity/rubber-banding) much safer.
