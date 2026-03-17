---
name: Stale state fields spread into awaiting_pickup_time transition
description: webhook.ts spreads the full selection record (including stale product_name etc.) when transitioning to awaiting_pickup_time, persisting unknown garbage to DB
type: pending
priority: p1
issue_id: "116"
tags: [data-integrity, whatsapp, state-machine, typescript]
dependencies: []
---

## Problem Statement

`webhook.ts:287` (confirm_cart button) and `webhook.ts:345` (building_order "2" text) both do:

```ts
await storePendingProductSelection(sb, phone, {
  ...selection,              // raw Record<string,unknown> from DB
  selection_type: 'awaiting_pickup_time',
  cart,
  created_at: new Date().toISOString(),
});
```

`selection` is `Record<string, unknown>` read directly from Supabase. When transitioning from `building_order` (which was previously `awaiting_qty`), the row may contain `product_name` and other keys from earlier states. Spreading carries these stale fields into the new state, polluting the DB row with undefined keys that could confuse future handlers.

More critically: there is no guard that `selection.selection_type === 'building_order'` before performing the transition. A stale `awaiting_qty` row could be promoted to `awaiting_pickup_time` — skipping the qty confirmation step entirely.

## Findings

- `webhook.ts:280–290` — `confirm_cart` button path
- `webhook.ts:339–350` — text "2" during `building_order` path
- Both should be transition functions in `selection-resolver.ts` that own a clean write

## Proposed Solutions

### Option A — Write only known fields; add type guard (Recommended)
```ts
if (selection?.selection_type !== 'building_order') return; // guard

await storePendingProductSelection(sb, phone, withTimestamp({
  selection_type: 'awaiting_pickup_time',
  cart,                     // only carry through cart
}));
```

**Pros:** Clean state; no garbage fields; guards against invalid transitions
**Cons:** None
**Effort:** Small
**Risk:** Low

### Option B — Export `transitionToPickupTime` from selection-resolver.ts
Move both transition sites to a single function in `selection-resolver.ts` that owns the write with correct field set and type guard.

**Pros:** Single authoritative transition; eliminates duplication
**Cons:** Small refactor
**Effort:** Small
**Risk:** Low

## Recommended Action

Option B (export transition function). Eliminates the duplication at both call sites simultaneously.

## Technical Details

- **Affected files:** `lib/whatsapp/webhook.ts:287, 345`, `lib/whatsapp/selection-resolver.ts`

## Acceptance Criteria

- [ ] No `{ ...selection }` spread in `awaiting_pickup_time` writes
- [ ] Written state contains only `{ selection_type, cart, created_at }`
- [ ] Guard: transition only proceeds if current `selection_type === 'building_order'`
- [ ] Test: confirm_cart on wrong state does not corrupt state

## Work Log

- 2026-03-17: Identified by data-integrity-guardian, typescript-reviewer, architecture-strategist review of PR #171
