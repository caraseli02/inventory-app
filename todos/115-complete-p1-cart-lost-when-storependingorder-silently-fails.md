---
name: Cart lost when storePendingOrder silently fails before clearPendingSelection
description: storePendingOrder catches all errors silently; if it fails, clearPendingSelection still runs, permanently losing the customer's cart with no retry path
type: pending
priority: p1
issue_id: "115"
tags: [data-integrity, whatsapp, cart, order, supabase]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:287–288`:

```ts
await storePendingOrder(args.sb, args.phone, pending);
await storePendingProductSelection(args.sb, args.phone, {});  // clears cart
```

These are two independent Supabase upserts on the same row. `storePendingOrder` (`conversation-state.ts:65–85`) catches all errors and returns silently. If Supabase is momentarily unavailable, the order is never saved, but `clearPendingSelection` runs anyway — the cart is wiped. The user sees the confirmation summary text but no order exists. There is no retry path.

## Findings

**`conversation-state.ts:65–85`** — `storePendingOrder` has a bare `try/catch` that logs and returns void:
```ts
} catch (err) {
  console.error('[whatsapp] failed to store pending order:', err);
}
```

After this returns (silently), `selection-resolver.ts:288` clears the selection. Cart is gone.

## Proposed Solutions

### Option A — Propagate the error; don't clear selection on failure (Recommended)
Remove the try/catch from `storePendingOrder` (or rethrow). In `handleCartPickupTime`, wrap both writes: if `storePendingOrder` throws, do NOT clear the selection. The user can retry by sending pickup time again.

```ts
await storePendingOrder(args.sb, args.phone, pending);    // may throw
await storePendingProductSelection(args.sb, args.phone, {}); // only if above succeeded
```

**Pros:** Cart preserved on transient failure; user can retry
**Cons:** User sees generic error message on Supabase failure
**Effort:** Small
**Risk:** Low

### Option B — Wrap both in a single Supabase RPC (atomic)
Create a Postgres function `confirm_cart_order(phone, pending_order_json)` that atomically sets `pending_order` and clears `pending_selection` in one transaction.

**Pros:** True atomicity
**Cons:** Migration required; more complex
**Effort:** Large
**Risk:** Medium

### Option C — Write pending_order first, clear selection in a finally block only if order write verified
Read back `pending_order` after write to verify, then clear selection.

**Pros:** More resilient without DB changes
**Cons:** Extra read; still not truly atomic
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A is the right short-term fix. Option B is the correct long-term architecture.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:287–288`, `lib/whatsapp/conversation-state.ts:65–85`

## Acceptance Criteria

- [ ] If `storePendingOrder` fails, `pending_selection` (cart) is NOT cleared
- [ ] Error propagates to caller so user sees retry prompt
- [ ] Unit test: simulated Supabase failure on storePendingOrder preserves cart state

## Work Log

- 2026-03-17: Identified by data-integrity-guardian and typescript-reviewer review of PR #171
