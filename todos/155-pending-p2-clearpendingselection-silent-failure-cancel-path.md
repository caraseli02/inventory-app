---
status: pending
priority: p2
issue_id: "155"
tags: [code-review, whatsapp, state-management, error-handling]
dependencies: []
---

# `clearPendingSelection` silent failure on confirm/cancel can recreate a cancelled order

## Problem Statement

In `lib/whatsapp/webhook.ts` (lines 241 and 259), after order confirm/cancel:
```typescript
await applyPendingOrderDecision(sb, phone, 'cancel');
await clearPendingSelection(sb, phone);  // void return, boolean silently discarded
```

`clearPendingSelection` delegates to `storePendingProductSelection(sb, phone, {})` and discards the boolean. If the clear fails silently after a **cancel**, `pending_selection` retains its last state (e.g. `building_order` or `awaiting_pickup_time`). The user's next text message triggers `handleQtyInput` or `handleCartPickupTime` — which re-enters the cart flow. Since `pending_order` is now null (cancelled), `handleCartPickupTime` calls `storePendingOrder` again with the old cart, creating a **new pending order for a cart the user just cancelled**.

The **confirm path** carries the same risk: a stale `pending_selection` after a successful confirm means any text within the 30-min TTL window re-creates a second order for the same cart.

## Findings

- `lib/whatsapp/webhook.ts` line 241: `await clearPendingSelection(sb, phone)` after cancel — no error check
- `lib/whatsapp/webhook.ts` line 259: `await clearPendingSelection(sb, phone)` after confirm — no error check
- `lib/whatsapp/selection-resolver.ts` line 209–210: `clearPendingSelection` returns `Promise<void>` — boolean from `storePendingProductSelection` discarded
- `handleCartPickupTime` has no "is there already a pending_order?" guard before calling `storePendingOrder`

## Proposed Solutions

### Option A: Log warning on clear failure at confirm/cancel call sites (Recommended, minimal)
Change `clearPendingSelection` to return `Promise<boolean>`:
```typescript
export async function clearPendingSelection(sb, phone): Promise<boolean> {
  return storePendingProductSelection(sb, phone, {});
}
```
Then at confirm/cancel sites:
```typescript
const cleared = await clearPendingSelection(sb, phone);
if (!cleared) {
  console.warn('[whatsapp] failed to clear pending_selection after confirm/cancel — stale cart may re-trigger', { phone });
}
```
- Effort: Small (signature change + 2 call sites)
- Risk: None (logging only, no behavior change)

### Option B: Add re-entry guard in `handleCartPickupTime`
Check for existing `pending_order` before writing a new one. Already described in todo 154 Option B.
- Effort: Medium
- Addresses the root cause (duplicate order creation) rather than logging the symptom

### Option C: Accept as known limitation with TTL recovery comment
Add a comment at the call site noting that TTL handles recovery.
- Does not prevent the order-recreation hazard
- Not recommended given the cancel path can produce ghost orders

**Recommended**: Option A (surface the failure in logs); Option B as a follow-up for full protection.

## Technical Details
- File: `lib/whatsapp/webhook.ts` lines 241, 259
- File: `lib/whatsapp/selection-resolver.ts` lines 205–210 (`clearPendingSelection`)

## Acceptance Criteria
- [ ] `clearPendingSelection` returns `Promise<boolean>`
- [ ] Both confirm/cancel call sites in `webhook.ts` log a warning on `false` return
- [ ] No retry or abort logic added (logging only)
- [ ] `pnpm vitest run tests/unit/whatsappAgent.test.ts` — all pass

## Work Log
- 2026-03-17: Found by data-integrity-guardian agent in ce-review of PR #173
