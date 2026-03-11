---
status: pending
priority: p2
issue_id: "083"
tags: [code-review, data-integrity, whatsapp, database]
dependencies: ["077"]
---

# `storePendingOrder` upsert can create `conversation_history` row with empty `messages`

## Problem Statement

`storePendingOrder` upserts `{ phone_number, pending_order }` to `conversation_history`. If the row does not yet exist (a new customer whose first interaction somehow hits the order flow before `appendHistory` creates the row), the INSERT will write `pending_order` with `messages` defaulting to `[]`. Any subsequent call to `getHistory` will return empty history, losing the current turn's context.

## Findings

- `api/whatsapp.ts:1342-1348` — upsert sends only `phone_number` + `pending_order`.
- `conversation_history` schema: `messages JSONB NOT NULL DEFAULT '[]'` — so INSERT without `messages` succeeds using the default.
- In practice the `storePendingOrder` call happens inside `waitUntil` after `buildReplyWithPending` has already called `appendHistory`. The normal flow is: `appendHistory` (creates row with messages) → `storePendingOrder` (updates pending_order on existing row). If `appendHistory` fails or races, `storePendingOrder` can create the row first.
- The same `upsert` on UPDATE does not touch `messages` — only INSERT is the risk.

## Proposed Solutions

### Option 1: Move `storePendingOrder` into the `consume_pending_order` / append RPC flow (Recommended)

**Approach:** Store `pending_order` as part of `appendHistory` rather than as a separate upsert. Pass the pending order to `appendHistory` and include it in the `append_conversation_history` RPC payload. This guarantees both writes happen atomically in the same row update.

**Pros:** Eliminates the separate upsert entirely; atomic.
**Cons:** Larger RPC change; tighter coupling between history and order state.
**Effort:** Medium
**Risk:** Low

---

### Option 2: Guard `storePendingOrder` to only UPDATE, never INSERT

**Approach:** Change `storePendingOrder` to use `.update()` instead of `.upsert()`, with a fallback that logs a warning if no row was updated (meaning `appendHistory` hasn't created the row yet):

```typescript
const { count } = await sb
  .from('conversation_history')
  .update({ pending_order: order as unknown })
  .eq('phone_number', phone)
  .select('id', { count: 'exact', head: true });
if (!count) console.warn('[whatsapp] storePendingOrder: no row found for', phone);
```

**Pros:** Prevents row creation with empty messages; simple change.
**Cons:** In the race condition, pending order is not stored at all — order confirmation flow silently fails instead of creating a bad row.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:1295-1311` — `storePendingOrder`

## Acceptance Criteria

- [ ] A new customer whose `conversation_history` row does not exist cannot get an empty-messages row from `storePendingOrder`
- [ ] `storePendingOrder` failure is observable (log or error) not silent
- [ ] Existing customers' `messages` field is not affected by pending order storage
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by data-integrity-guardian review agent

## Resources

- **PR:** #156
- **Related:** todo 077, todo 078
