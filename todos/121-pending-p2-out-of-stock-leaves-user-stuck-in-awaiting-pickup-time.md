---
name: OUT_OF_STOCK / NOT_FOUND errors leave user stuck in awaiting_pickup_time state
description: When resolveOrderItems fails with OUT_OF_STOCK_ITEM or NOT_FOUND_ITEM, handleCartPickupTime sends a friendly message but does NOT roll back selection_type, trapping the user
type: pending
priority: p2
issue_id: "121"
tags: [whatsapp, state-machine, error-handling, ux]
dependencies: ["117"]
---

## Problem Statement

`selection-resolver.ts:263–277` — when `resolveOrderItems` throws `OUT_OF_STOCK_ITEM:` or `NOT_FOUND_ITEM:`, the function sends a friendly error message and returns `true` (intercepted). However, `pending_selection.selection_type` remains as `awaiting_pickup_time`. On the user's next message (e.g., resending "18:30", or any text), `handleCartPickupTime` fires again, hits the same error again. The user is trapped with no escape except typing "Caut un produs" to reset state.

## Findings

- `selection-resolver.ts:269–276` — OUT_OF_STOCK and NOT_FOUND paths return without state rollback
- Same issue applies to AMBIGUOUS_ITEM (see todo #117)
- Expected UX: roll back to `building_order` so user can modify/replace the problematic item

## Proposed Solutions

### Option A — Roll back to building_order on item resolution failure (Recommended)
After sending the error message, restore state:
```ts
await storePendingProductSelection(args.sb, args.phone,
  withTimestamp({ selection_type: 'building_order', cart }));
```

**Pros:** User can see their cart, choose to add/remove items
**Cons:** None
**Effort:** Small
**Risk:** Low

### Option B — Clear the specific problem item from cart and prompt
Identify the failing item, remove it from `cart`, restore `building_order` with updated cart.

**Pros:** More guided UX
**Cons:** More complex; product name matching needed
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A. Rollback to `building_order` lets the user see the cart summary and decide next steps.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:263–277`

## Acceptance Criteria

- [ ] OUT_OF_STOCK_ITEM error rolls back to `building_order` state
- [ ] NOT_FOUND_ITEM error rolls back to `building_order` state
- [ ] User receives cart summary after rollback so they know their cart is intact
- [ ] Test: out-of-stock error does not leave state as `awaiting_pickup_time`

## Work Log

- 2026-03-17: Identified by data-integrity-guardian review of PR #171
