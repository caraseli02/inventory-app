---
status: pending
priority: p2
issue_id: "080"
tags: [code-review, data-integrity, whatsapp, orders, business-logic]
dependencies: ["078"]
---

# Clarify and fix order status on creation: `'pending'` vs `'confirmed'`

## Problem Statement

`createPendingOrderFromPending` inserts orders with `status: 'pending'`. The PR description states that a button tap should produce `status: 'confirmed'`. Both the button-tap path and the DA text path go through the same function, so both get `'pending'`. If the owner UI's "new orders" view filters on `status = 'confirmed'`, button-confirmed orders will never appear there — a silent business logic error.

## Findings

- `api/whatsapp.ts:1449-1468` — `createPendingOrderFromPending` inserts `status: 'pending'`.
- PR description: "confirm → insert to DB" with button label "✅ Da, confirmă" — implies customer confirmation.
- `src/lib/orders-api.ts:102` — `confirmOrder` transitions `pending → confirmed` + deducts stock. This implies `'pending'` = "received, awaiting store confirmation".
- If `'pending'` is the correct status (store must still acknowledge), the PR description's button label is misleading.
- If `'confirmed'` is the correct status for button-confirmed orders, `createPendingOrderFromPending` is wrong.

## Proposed Solutions

### Option 1: Keep `'pending'` — document the intended two-step flow (Recommended if store acknowledges orders)

**Approach:** Document that WhatsApp orders enter as `'pending'` (store not yet confirmed). Store owner confirms in the Orders UI, which deducts stock. Update the PR description and button label to reflect this.

**Pros:** Consistent with `orders-api.ts` flow; stock is only deducted on store confirmation.
**Cons:** Requires updating PR description and potential UI label.
**Effort:** Tiny
**Risk:** Low

---

### Option 2: Insert as `'confirmed'` for button-tap, `'pending'` for DA text

**Approach:** Pass a `status` parameter to `createPendingOrderFromPending`. Button path passes `'confirmed'`, DA text passes `'pending'`.

**Pros:** Distinguishes customer-confirmed (high intent) from text-confirmed (less certain).
**Cons:** `'confirmed'` would skip the store acknowledgment step and deduct stock — requires `confirmOrder` logic to be called too.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:1449-1468` — `createPendingOrderFromPending`
- `src/lib/orders-api.ts:102` — `confirmOrder` (reference for status flow)

## Acceptance Criteria

- [ ] The intended status on WhatsApp order creation is explicitly decided and documented
- [ ] `createPendingOrderFromPending` uses the correct status
- [ ] Orders created via WhatsApp appear in the correct owner UI view
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by data-integrity-guardian review agent

## Resources

- **PR:** #156
