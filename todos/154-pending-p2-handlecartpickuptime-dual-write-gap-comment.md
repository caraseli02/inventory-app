---
status: pending
priority: p2
issue_id: "154"
tags: [code-review, whatsapp, state-management, documentation]
dependencies: []
---

# `handleCartPickupTime` dual-write gap is undocumented — stale `pending_selection` can trigger duplicate confirmation

## Problem Statement

In `handleCartPickupTime` (lines 312–313 of `selection-resolver.ts`):
```typescript
await storePendingOrder(args.sb, args.phone, pending);
await storePendingProductSelection(args.sb, args.phone, {});  // boolean ignored
```

If `storePendingOrder` succeeds but `storePendingProductSelection({})` fails silently (returns `false`), the user ends up with both `pending_order` written AND `pending_selection` still containing `{ selection_type: 'awaiting_pickup_time', cart: [...] }`. On the next message, `handleCartPickupTime` fires again (selection still valid), overwrites the `pending_order` with the same data, and sends a second confirmation message. The `consume_pending_order` RPC prevents double-billing, but the duplicate UX message is confusing.

This is a known accepted limitation (TTL = 30 min provides recovery), but there is no comment explaining:
1. Why the `storePendingProductSelection({})` boolean is intentionally ignored here
2. That the throw-propagation from `storePendingOrder` is the mechanism that prevents premature cart clearing
3. That `consume_pending_order` provides double-confirm protection downstream

Without these comments, a future developer will "fix" the ignored boolean by adding a guard, breaking the CLAUDE.md safety invariant.

## Proposed Solutions

### Option A: Add inline comments at the dual-write boundary (Recommended, minimal)
```typescript
// storePendingOrder throws on failure — if it throws here, the cart (pending_selection)
// is preserved intact for retry. Do NOT wrap this in try/catch.
await storePendingOrder(args.sb, args.phone, pending);
// Best-effort clear: if this fails, pending_selection stays populated.
// The user may re-trigger this handler on their next message, sending a second
// confirmation, but consume_pending_order (atomic RPC) prevents double-billing.
// The 30-minute PENDING_SELECTION_TTL provides recovery if the clear never succeeds.
await storePendingProductSelection(args.sb, args.phone, {});  // best-effort, boolean intentionally ignored
```
- Effort: Tiny
- Risk: None

### Option B: Add a peek-before-write guard to prevent the duplicate confirmation
```typescript
const existingOrder = await peekPendingOrder(args.sb, args.phone);
if (existingOrder) {
  // Order already committed (clear failed on prior attempt). Clear stale selection and resend confirmation.
  await storePendingProductSelection(args.sb, args.phone, {});
  // ...resend confirmation for existing order
  return true;
}
await storePendingOrder(...);
await storePendingProductSelection(...);
```
- Effort: Medium (extra DB read per pickup-time message + edge case handling)
- Risk: Low — extra round trip, but eliminates duplicate message scenario entirely

**Recommended**: Option A immediately (prevents future refactor regression); Option B as a follow-up if duplicate messages are observed in production.

## Technical Details
- File: `lib/whatsapp/selection-resolver.ts` lines 312–313
- Related guardrail: CLAUDE.md "Never clear cart state (`pending_selection`) before `storePendingOrder` write completes without error"
- Related solution doc: `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`

## Acceptance Criteria
- [ ] Lines 312–313 have inline comments explaining: (1) throw-propagation intent, (2) best-effort clear rationale, (3) TTL recovery mechanism
- [ ] No logic changes required (documentation only for Option A)

## Work Log
- 2026-03-17: Found by data-integrity-guardian + architecture-strategist agents in ce-review of PR #173
