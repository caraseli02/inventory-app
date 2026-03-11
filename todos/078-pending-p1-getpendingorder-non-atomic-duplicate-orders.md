---
status: pending
priority: p1
issue_id: "078"
tags: [code-review, data-integrity, security, whatsapp, orders, race-condition, database]
dependencies: ["077"]
---

# Replace non-atomic `getPendingOrder` with atomic RPC to prevent duplicate orders

## Problem Statement

`getPendingOrder` performs two sequential Supabase calls: a SELECT then an UPDATE to null the field. Between these two calls, a concurrent request can read the same non-null pending order and also proceed to insert an order. A customer double-tapping the confirm button, or tapping confirm while simultaneously sending "DA" text, will produce two duplicate orders in the `orders` table. There is no uniqueness constraint to prevent this.

## Findings

- `api/whatsapp.ts:1357-1383` — `getPendingOrder`: SELECT → conditional UPDATE (two round trips, not atomic).
- `api/whatsapp.ts:140-158` — button confirm path calls `getPendingOrder` inside `waitUntil`.
- `api/whatsapp.ts:201-214` — DA text confirm path calls `getPendingOrder` synchronously.
- Both paths can run concurrently. A double-tap sends two concurrent POST requests to Vercel, both entering the button handler, both calling `getPendingOrder` before either clears the field.
- `docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md` — prior learning confirms atomic RPC pattern was already established for `append_conversation_history`. Same approach required here.
- `supabase/migrations/20260305153000_conversation_history_append_rpc.sql` — reference for RPC migration pattern.

## Proposed Solutions

### Option 1: Supabase RPC `consume_pending_order` (Recommended)

**Approach:** Add a migration with a PostgreSQL function:

```sql
CREATE OR REPLACE FUNCTION consume_pending_order(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order JSONB;
BEGIN
  UPDATE conversation_history
  SET pending_order = NULL
  WHERE phone_number = p_phone
    AND pending_order IS NOT NULL
  RETURNING pending_order INTO v_order;
  RETURN v_order;
END;
$$;
```

Then replace `getPendingOrder` with:

```typescript
async function getPendingOrder(sb, phone): Promise<PendingOrder | null> {
  const { data } = await sb.rpc('consume_pending_order', { p_phone: phone });
  return (data ?? null) as PendingOrder | null;
}
```

The `UPDATE … WHERE pending_order IS NOT NULL RETURNING` is atomic — PostgreSQL row-level lock ensures only one concurrent call gets the value back.

**Pros:** Eliminates race entirely; single round trip; mirrors existing RPC pattern in codebase.
**Cons:** Requires migration + RPC call pattern (already established).
**Effort:** Small
**Risk:** Low

---

### Option 2: Add unique constraint on orders (partial fix only)

**Approach:** Add `UNIQUE (customer_phone, pickup_time)` on `orders`.

**Pros:** Prevents duplicate inserts at DB level.
**Cons:** Does not fix the race itself — just makes one insert fail with an error instead of silently creating a duplicate. Customer gets a confusing error. Does not address the double-read window.
**Effort:** Small
**Risk:** Medium (error handling required)

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `supabase/migrations/` — new RPC migration
- `api/whatsapp.ts:1316-1383` — `getPendingOrder` replacement
- Both call sites: button handler (line 143), DA/NU handler (line 203), cancel paths (lines 151, 213)

## Acceptance Criteria

- [ ] `consume_pending_order` RPC exists in migrations
- [ ] `getPendingOrder` uses the RPC in a single call
- [ ] Concurrent double-tap test: second call returns `null`, no second order inserted
- [ ] Cancel path still correctly clears pending order
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by data-integrity-guardian + security-sentinel review agents

**Actions:** Confirmed non-atomic pattern across both call sites. Identified prior `append_conversation_history` RPC as reference.

## Resources

- **PR:** #156
- **Prior learning:** `docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`
- **Reference RPC migration:** `supabase/migrations/20260305153000_conversation_history_append_rpc.sql`
- **Related:** todo 077 (add `pending_order` column)
