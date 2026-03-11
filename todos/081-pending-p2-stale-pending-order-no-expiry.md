---
status: pending
priority: p2
issue_id: "081"
tags: [code-review, data-integrity, whatsapp, orders]
dependencies: ["077"]
---

# Add TTL / expiry check to `pending_order` to prevent accidental stale confirmations

## Problem Statement

`pending_order` in `conversation_history` has no expiry. If a customer starts an order but never confirms or cancels, the pending order persists indefinitely. Days later, if the customer sends "DA" in a completely different context (e.g., "Da, vreau să mai comand mâine"), `getPendingOrder` returns the stale order and `createPendingOrderFromPending` inserts it — creating an order the customer did not intend.

## Findings

- `api/whatsapp.ts:1319-1342` — `storePendingOrder` stores `PendingOrder` JSONB with no `created_at` timestamp.
- `api/whatsapp.ts:1357-1383` — `getPendingOrder` retrieves the order with no expiry check.
- `PendingOrder` interface (line 1419) has no `created_at` field.
- No TTL enforcement anywhere in the pending order flow.

## Proposed Solutions

### Option 1: Embed `created_at` in JSONB + check TTL in `getPendingOrder` (Recommended)

**Approach:** Add `created_at: string` (ISO timestamp) to `PendingOrder`. In `processOrderIntent`, set it before storing. In `getPendingOrder` (or the `consume_pending_order` RPC), check if `(now - created_at) > TTL_HOURS`:

```typescript
// In processOrderIntent, before storePendingOrder:
const pending: PendingOrder = {
  ...resolvedFields,
  created_at: new Date().toISOString(),
};
```

```sql
-- In consume_pending_order RPC, add expiry guard:
AND (pending_order->>'created_at')::timestamptz > NOW() - INTERVAL '24 hours'
```

If expired: clear the pending order, return null.

**Pros:** No schema change needed (timestamp in JSONB); TTL enforced atomically at DB level in the RPC; configurable.
**Cons:** Requires coordination with todo 078 (RPC).
**Effort:** Small
**Risk:** Low

---

### Option 2: Use `updated_at` column on `conversation_history` as proxy

**Approach:** In `getPendingOrder`, check `updated_at` of the row — if older than TTL, treat `pending_order` as expired.

**Pros:** No JSONB change.
**Cons:** `updated_at` is updated by `appendHistory` too — any conversation activity resets the TTL clock, so a pending order would never expire for an active customer. Not reliable.
**Effort:** Small
**Risk:** Medium (unreliable expiry)

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:1377-1399` — `PendingOrder` interface — add `created_at`
- `api/whatsapp.ts:1411-1431` — `processOrderIntent` — set `created_at`
- `supabase/migrations/` — update `consume_pending_order` RPC with expiry guard (coordinate with todo 078)

## Acceptance Criteria

- [ ] `PendingOrder` carries a `created_at` timestamp
- [ ] Orders older than 24h (configurable) are treated as expired by `getPendingOrder`/RPC
- [ ] Expired pending orders are cleared from DB, not just ignored
- [ ] Customer receives "comanda a expirat" response on expired-order confirm attempt
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by data-integrity-guardian review agent

## Resources

- **PR:** #156
- **Related:** todo 078 (atomic RPC)
