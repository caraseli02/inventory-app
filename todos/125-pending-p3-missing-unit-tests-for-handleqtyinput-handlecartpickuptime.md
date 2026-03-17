---
name: Missing unit tests for handleQtyInput and handleCartPickupTime
description: Two new handlers introduced in PR #171 have zero direct unit tests; they are the most complex new additions and carry the highest regression risk
type: pending
priority: p3
issue_id: "125"
tags: [testing, whatsapp, cart]
dependencies: []
---

## Problem Statement

`tests/unit/lib/whatsapp-selection-resolver.test.ts` covers all existing functions but adds no tests for `handleQtyInput` and `handleCartPickupTime` — the two new handlers introduced in this PR. These are the most complex additions (multi-step state transitions, order creation, error branching) and carry the highest regression risk.

## Missing test cases

**handleQtyInput:**
- Parses valid qty from text, adds to empty cart
- Parses valid qty, appends to existing cart
- Ignores non-numeric text (returns false)
- Ignores zero/negative numbers
- Sends cart summary message with add-more/confirm options
- Returns false when selection_type is not awaiting_qty
- Returns false when selection is expired

**handleCartPickupTime:**
- Happy path: creates pending order, clears selection
- OUT_OF_STOCK_ITEM: sends friendly message, returns true
- NOT_FOUND_ITEM: sends friendly message, returns true
- AMBIGUOUS_ITEM: handled gracefully (after fix in todo #117)
- Returns false when selection_type is not awaiting_pickup_time
- storePendingOrder failure: cart NOT cleared (after fix in todo #115)

## Proposed Solution

Add test blocks to `tests/unit/lib/whatsapp-selection-resolver.test.ts`. Mock `resolveOrderItems` from `inventory.js` and `storePendingOrder` from `conversation-state.js`.

## Technical Details

- **Affected files:** `tests/unit/lib/whatsapp-selection-resolver.test.ts`

## Acceptance Criteria

- [ ] At least 8 test cases for `handleQtyInput`
- [ ] At least 6 test cases for `handleCartPickupTime`
- [ ] Test coverage includes all error branches (OUT_OF_STOCK, NOT_FOUND, AMBIGUOUS)
- [ ] Tests pass with `pnpm test:unit`

## Work Log

- 2026-03-17: Identified by typescript-reviewer review of PR #171
