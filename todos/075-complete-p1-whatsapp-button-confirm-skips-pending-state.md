---
status: complete
priority: p1
issue_id: "075"
tags: [code-review, data-integrity, whatsapp, orders, api]
dependencies: []
---

# Keep WhatsApp-confirmed orders in `pending` until owner confirmation

## Problem Statement

The new quick-reply confirm flow inserts orders directly with `status: 'confirmed'` as soon as the customer taps the button or replies `DA/YES`.

That violates the WhatsApp spec and the existing order lifecycle: orders should be created as `pending`, then only the owner’s in-app confirm action should transition them to `confirmed` and deduct stock.

## Findings

- `docs/specs/whatsapp_agent.md:94-100` requires order creation with status `pending`.
- `docs/specs/whatsapp_agent.md:123-129` explicitly says stock deduction happens only when the owner confirms in the app.
- `api/whatsapp.ts:148-157` inserts button-confirmed orders with `status: 'confirmed'`.
- `api/whatsapp.ts:207-216` does the same for typed `DA/YES` fallback.
- `src/lib/orders-api.ts:95-146` treats owner confirmation as the only stock-deducting transition, so this webhook path now bypasses the intended workflow and makes order status semantics inconsistent across channels.

## Proposed Solutions

### Option 1: Insert as `pending` and send customer acknowledgment only

**Approach:** Change both customer-confirm paths to create `pending` orders, then keep owner confirmation in `confirmOrder()` as the only status promotion/deduction path.

**Pros:**
- Matches the spec
- Keeps all stock and status semantics in one flow
- Lowest-risk fix

**Cons:**
- Customer copy may need to say “request recorded” instead of “confirmed”

**Effort:** Small

**Risk:** Low

---

### Option 2: If customer confirmation should mean real confirmation, route through shared domain logic

**Approach:** Create the order as `pending`, then call the same confirmation path used by the owner so stock movements and concurrency rules stay centralized.

**Pros:**
- Preserves consistency if product requirements changed
- Reuses existing optimistic-lock logic

**Cons:**
- Changes product semantics substantially
- Still conflicts with the current spec unless the spec is updated

**Effort:** Medium

**Risk:** Medium

---

### Option 3: Introduce a new status such as `customer_confirmed`

**Approach:** Distinguish customer acceptance from owner fulfillment with an explicit intermediate status.

**Pros:**
- Clarifies state transitions
- Avoids overloading `confirmed`

**Cons:**
- Requires schema, UI, and notification changes
- Larger scope than this PR needs

**Effort:** Medium-Large

**Risk:** Medium

## Recommended Action

Implemented Option 1. Customer-side confirmation now records the order as `pending`, and owner confirmation remains the only path that should promote it to `confirmed`.

## Technical Details

**Affected files:**
- `api/whatsapp.ts:148`
- `api/whatsapp.ts:207`
- `src/lib/orders-api.ts:95`
- `docs/specs/whatsapp_agent.md:94`

## Resources

- **PR:** #156
- **Commit under review:** `ac4a21a`

## Acceptance Criteria

- [x] WhatsApp customer confirmation creates or preserves orders in `pending` status
- [x] Owner confirmation remains the only path that transitions to `confirmed`
- [x] Stock deduction still happens only through `confirmOrder()`
- [x] Tests cover button-confirm and `DA/YES` fallback status behavior

## Work Log

### 2026-03-10 - Review finding

**By:** Codex

**Actions:**
- Reviewed the new button-confirm and text-confirm branches in `api/whatsapp.ts`
- Cross-checked them against the WhatsApp feature spec and the existing owner confirmation logic
- Verified the two flows now disagree on what `confirmed` means

**Learnings:**
- Reusing the existing `confirmed` status for customer taps creates a hidden semantic split and undermines the stock workflow guarantees

### 2026-03-10 - Fix implemented

**By:** Codex

**Actions:**
- Added `createPendingOrderFromPending()` in `api/whatsapp.ts`
- Updated both button-confirm and `DA/YES` fallback flows to insert orders with `status: 'pending'`
- Adjusted customer-facing copy to say the request is recorded and awaiting store confirmation
- Added a unit test proving the helper inserts `pending` orders

**Learnings:**
- Pulling the insert logic into one helper made the workflow explicit and reduced the chance of future status drift
