---
name: Concurrent qty messages cause last-write-wins cart corruption
description: handleQtyInput does a read-modify-write on pending_selection with no optimistic locking; double-tap or WhatsApp retry can silently drop one cart item
type: pending
priority: p2
issue_id: "124"
tags: [data-integrity, whatsapp, cart, concurrency, supabase]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:229–232`:

```ts
const existingCart: CartItem[] = (selection.cart as CartItem[] | undefined) ?? [];
const cart: CartItem[] = [...existingCart, { name: product, qty }];
await storePendingProductSelection(..., { selection_type: 'building_order', cart });
```

This is a read-modify-write with no optimistic locking or CAS. Supabase `upsert` is last-write-wins. If a user double-taps qty or WhatsApp retries delivery:

1. Request A reads `existingCart = [item1]`
2. Request B reads `existingCart = [item1]` (before A has written)
3. Request A writes `[item1, item2]`
4. Request B writes `[item1, item2]` (overwrites A's write — same result, fine here)

Actually the same message is idempotent here. The real race is `sendCategoryPicker(preserveCart: true)` at `selection-resolver.ts:169–176` — if two "add more" taps arrive concurrently, one could read stale state and overwrite a cart that has already advanced.

## Proposed Solutions

### Option A — Add MessageSid dedup at the WhatsApp message level (Recommended)
The existing dedup mechanism at `webhook.ts:572` already deduplicates by `MessageSid`. WhatsApp retries use the same SID, so duplicate delivery of the same message is already handled. The real risk is two *different* user messages processed concurrently.

For now, document the known race and add Postgres-level version counter as a follow-up.

**Effort:** Trivial (documentation)
**Risk:** Low

### Option B — Use Postgres advisory lock on phone number
Before any read-modify-write in the cart flow, acquire `pg_advisory_xact_lock(hashtext(phone))`.

**Pros:** True serialization per phone
**Cons:** Requires Supabase RPC; adds latency; lock contention on busy phones
**Effort:** Large
**Risk:** Medium

### Option C — Atomic append via Postgres jsonb_insert RPC
Replace read-modify-write with a Supabase RPC that does `jsonb_set(pending_selection, '{cart}', cart || $new_item)` atomically.

**Pros:** No lock; atomic; single round trip
**Cons:** Requires migration + RPC
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A (document + dedup review) now, Option C as hardening follow-up.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:229–232, 169–176`

## Acceptance Criteria

- [ ] Race condition documented in code comment
- [ ] Existing MessageSid dedup verified to cover WhatsApp retry case
- [ ] Follow-up ticket created for atomic cart append

## Work Log

- 2026-03-17: Identified by data-integrity-guardian review of PR #171
