---
status: complete
priority: p1
issue_id: "159"
tags: [code-review, whatsapp, supabase, data-integrity]
dependencies: []
---

# storePendingOrder must surface Supabase errors (prevent cart/order state loss)

## Problem Statement

We rely on `storePendingOrder()` succeeding before we clear transactional cart state (`pending_selection`). If Supabase returns `{ error }` without throwing, we can wipe the cart and still fail to persist `pending_order`, stranding the user.

## Findings

- In [conversation-state.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts) `storePendingOrder()` awaits `sb.from(...).upsert(...)` but does not inspect the `{ error }` result. Supabase JS typically returns `{ data, error }` rather than throwing by default.
- In [selection-resolver.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts), `handleCartPickupTime()` clears `pending_selection` right after `storePendingOrder()` returns, assuming the write succeeded.
- This is the same class of bug documented in `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`, but the current implementation still risks a silent failure depending on Supabase client settings.

## Proposed Solutions

### Option 1: Check `{ error }` and throw (recommended)

**Approach:** Capture the result of `.upsert(...)`; if `error`, throw. Callers already have outer error handlers and should not clear cart when this throws.

**Pros:**
- Aligns with transactional invariant: never clear dependent state after a failed write
- Minimal API churn (still `Promise<void>`)

**Cons:**
- Requires touching a core state boundary (needs careful test coverage)

**Effort:** 1-2 hours

**Risk:** Medium

---

### Option 2: Return `Promise<boolean>` like `storePendingProductSelection`

**Approach:** Return `true/false`, and require call sites to branch on success.

**Pros:**
- Consistent with other state writes already using boolean success

**Cons:**
- API change ripples to all call sites

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- `lib/whatsapp/conversation-state.ts` (`storePendingOrder`)
- `lib/whatsapp/selection-resolver.ts` (`handleCartPickupTime`)
- Tests: add a unit test with a Supabase stub returning `{ error }` and assert `pending_selection` is preserved.

## Acceptance Criteria

- [ ] `storePendingOrder()` fails loud on Supabase `{ error }` (throw or false).
- [ ] When `storePendingOrder()` fails, cart state is not cleared.
- [ ] Tests cover the non-throwing `{ error }` failure mode.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Inspected `storePendingOrder` implementation and cart-flow ordering around cart clearing.
- Cross-referenced with documented “silent store failure wipes selection state” solution.

**Learnings:**
- Removing `try/catch` is not sufficient if the Supabase client does not throw on `{ error }`.
