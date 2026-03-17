---
status: pending
priority: p3
issue_id: "157"
tags: [code-review, whatsapp, state-management, concurrency]
dependencies: []
---

# Concurrent cart writes in `handleQtyInput` are last-write-wins — document as known limitation

## Problem Statement

`handleQtyInput` performs a read-modify-write on `pending_selection.cart`:
1. READ `pending_selection` from Supabase
2. COMPUTE `cart = [...existingCart, { name, qty }]`
3. WRITE `pending_selection` via upsert

There is no optimistic locking, version field, or SELECT FOR UPDATE. If two messages arrive simultaneously (e.g., user double-sends), both reads see the same `existingCart`, both compute different carts, and the second write silently overwrites the first — one cart item is lost.

The same race applies in `sendCategoryPicker` (when `preserveCart: true`) and in `webhook.ts` line 290 (cart passed to `awaiting_pickup_time`).

In practice this is low-probability: WhatsApp Twilio delivery is serial for a single user and human typing speed creates natural spacing. But a user with a flaky connection causing Twilio retries could hit this.

## Proposed Solutions

### Option A: Document as known limitation (Recommended for now)
Add a comment above the read-modify-write in `handleQtyInput`:
```typescript
// NOTE: This is a read-modify-write without optimistic locking.
// Two simultaneous messages from the same phone are last-write-wins.
// In practice Twilio delivers messages serially, making this rare.
// Long-term fix: append-only cart_items table or selection_version field.
```
- Effort: Tiny
- Risk: None

### Option B: Add a `selection_version` field (medium-term)
Include an integer version in `pending_selection`. Reject writes where the version read differs from the DB current. Requires an atomic RPC (similar to `consume_pending_order`).
- Effort: Large (new RPC, migration, version threading through all callers)

### Option C: Move cart to a dedicated `cart_items` table with append semantics
Eliminates the read-modify-write entirely. Long-term roadmap item.
- Effort: Very Large

**Recommended**: Option A now; Option B in a future hardening sprint if concurrent-message incidents are observed.

## Technical Details
- File: `lib/whatsapp/selection-resolver.ts` lines 241–244 (`handleQtyInput`)
- Also: `sendCategoryPicker` lines 178–183 (cart read when `preserveCart: true`)
- The `checkAndMarkMessageSid` dedup does NOT cover this — it deduplicates by Twilio `MessageSid`, not by DB row version

## Acceptance Criteria
- [ ] Comment added above read-modify-write in `handleQtyInput` explaining the known limitation
- [ ] Comment added in `sendCategoryPicker` cart-read block
- [ ] No logic changes required

## Work Log
- 2026-03-17: Found by data-integrity-guardian agent in ce-review of PR #173
