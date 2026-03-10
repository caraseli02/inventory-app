---
status: pending
priority: p1
issue_id: "077"
tags: [code-review, data-integrity, whatsapp, orders, migration, database]
dependencies: []
---

# Add missing `pending_order` column migration to `conversation_history`

## Problem Statement

`storePendingOrder` and `getPendingOrder` in `api/whatsapp.ts` reference a `pending_order` JSONB column on `conversation_history`, but no migration adds this column. In any deployed environment where migrations are applied from the repo the column does not exist, causing PostgREST to return a column-not-found error at runtime. The entire Quick Reply confirmation flow is silently broken in production.

## Findings

- `api/whatsapp.ts:1342-1348` — `storePendingOrder` upserts `{ phone_number, pending_order }`.
- `api/whatsapp.ts:1362-1364` — `getPendingOrder` selects `pending_order` and updates it to `null`.
- Searching all `.sql` files in `supabase/migrations/` returns **zero** occurrences of `pending_order`.
- Original `conversation_history` migration creates only `id`, `phone_number`, `messages`, `created_at`, `updated_at`.
- Every call to `storePendingOrder` or `getPendingOrder` on a production-migrated DB will throw.

## Proposed Solutions

### Option 1: Add a new migration file (Recommended)

**Approach:** Create `supabase/migrations/<timestamp>_add_pending_order_to_conversation_history.sql`:

```sql
ALTER TABLE conversation_history
  ADD COLUMN IF NOT EXISTS pending_order JSONB DEFAULT NULL;
```

**Pros:** Standard migration workflow; `IF NOT EXISTS` is safe to re-run; nullable with DEFAULT NULL so existing rows unaffected.

**Cons:** Requires coordinated deploy (migration before code).

**Effort:** Small
**Risk:** Low

---

### Option 2: Include in a combined migration with RPC (see todo 078)

**Approach:** Bundle this column addition with the `consume_pending_order` RPC migration from todo 078 into a single migration file.

**Pros:** One migration for the whole pending-order feature.

**Cons:** Coupling two concerns.

**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `supabase/migrations/` — new file needed
- `api/whatsapp.ts:1295-1383` — `storePendingOrder`, `getPendingOrder`

## Acceptance Criteria

- [ ] Migration file exists that adds `pending_order JSONB DEFAULT NULL` to `conversation_history`
- [ ] `storePendingOrder` and `getPendingOrder` succeed against a migrated DB
- [ ] `pnpm typecheck` passes
- [ ] Existing conversation history rows are not affected

## Work Log

### 2026-03-10 — Found by data-integrity-guardian review agent

**Actions:** Confirmed absence of `pending_order` across all migration files.

## Resources

- **PR:** #156
- **Related:** todo 078 (atomic consume RPC)
