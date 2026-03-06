---
status: complete
priority: p2
issue_id: "069"
tags: [code-review, ux, accessibility, mobile, orders]
dependencies: []
---

# Orders (mobile): add clear non-gesture actions fallback

## Problem Statement

The new Option B pattern makes **swipe-to-reveal** the primary way to confirm/reject on mobile. While there is an expanded-state fallback, it can be hard to discover and adds extra steps for users who can’t or don’t want to use gestures.

This is a UX + accessibility risk for a high-impact action (confirm deducts stock).

## Findings

- Mobile behavior is driven by `swipeEnabled = isMobile && isPending` in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:75`–`:80`.
- On mobile, the only always-visible affordance is the small “Swipe ←” hint in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:241`–`:246`.
- The visible buttons fallback is only rendered when the card is expanded (`mobileFallbackActions`) in `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:106`–`:108` and `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:336`–`:366`.
- “Confirm” triggers stock deduction immediately; mobile discoverability issues can produce operator errors during busy periods.

## Proposed Solutions

### Option 1: Add a compact visible “Actions” affordance (recommended)

**Approach:** On mobile + pending + collapsed, show a small `Actions` button (kebab/ellipsis) that opens a mini-sheet with Confirm/Reject. Keep swipe as a fast-path.

**Pros:**
- Non-gesture path is obvious and accessible
- Keeps the card visually clean (one button)
- Works well for screen readers and keyboard (external keyboards on mobile/tablet)

**Cons:**
- Adds one extra tap vs. direct visible buttons
- Requires building a small overlay/sheet (Radix Dialog or similar)

**Effort:** 2–4 hours

**Risk:** Low

---

### Option 2: Keep compact visible Confirm/Reject buttons on mobile (no sheet)

**Approach:** Render smaller Confirm/Reject buttons below the summary on mobile even when collapsed.

**Pros:**
- Maximum discoverability, least cognitive load
- One-tap actions without gestures or overlays

**Cons:**
- Higher visual density; can feel “heavy” for the list
- Increases accidental tap risk without guardrails

**Effort:** 1–2 hours

**Risk:** Medium

---

### Option 3: Coachmark + keep expanded fallback only

**Approach:** Show a one-time coachmark (“Swipe left to confirm/reject”) using `localStorage`, keep current expanded fallback.

**Pros:**
- Minimal UI change
- Still nudges users towards swipe

**Cons:**
- Still weak for accessibility and users who avoid gestures
- Coachmarks are easy to miss/dismiss

**Effort:** 1–2 hours

**Risk:** Medium

## Recommended Action

Implemented **Option 1**: a compact, always-visible **Actions** trigger on mobile that opens a bottom sheet containing Confirm/Reject.

Swipe-to-reveal remains available as a fast-path, but is no longer required for access to the actions.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:75` (swipe as primary action)
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:241` (Swipe hint)
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx:336` (expanded fallback actions)

## Resources

- **Related change:** Option B UX implementation

## Acceptance Criteria

- [x] On mobile, pending orders have a clear, always-visible non-gesture action path (button/menu)
- [x] Swipe remains available as a fast-path, but is not required
- [x] Screen reader users can reach Confirm/Reject without needing swipe (via Actions button + sheet)
- [x] Manual QA: busy-operator workflow feels faster and safer

## Work Log

### 2026-03-05 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed new Option B behavior and interaction paths
- Identified gesture-only discovery risks for high-impact actions
- Drafted solution options (visible Actions button vs. compact buttons vs. coachmark)

**Learnings:**
- Swipe can be a great fast-path, but needs a visible alternative for accessibility and confidence

### 2026-03-05 - Implemented mobile Actions sheet

**By:** Codex

**Actions:**
- Added a visible mobile Actions trigger that opens a bottom `Sheet` with Confirm/Reject.
- Kept swipe-to-reveal as the fast path for quick operators.

**Files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`

**Learnings:**
- A single visible affordance (kebab → sheet) keeps the list clean while satisfying accessibility/discoverability.
