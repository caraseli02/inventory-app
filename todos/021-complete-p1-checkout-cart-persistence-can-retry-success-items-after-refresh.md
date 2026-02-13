---
status: complete
priority: p1
issue_id: "021"
tags: [code-review, checkout, data-integrity, localstorage]
dependencies: []
---

# Prevent Duplicate Checkout After Refresh When Some Items Already Succeeded

## Problem Statement

Checkout cart persistence currently rehydrates items without their `status`. If a checkout partially succeeds (some items are `success`, some `failed`) and the user refreshes `/checkout`, previously-successful items can be treated as pending again and re-processed, causing stock to be decremented twice.

## Findings

- `src/pages/CheckoutPage.tsx:603` persists `state.cart` wholesale via `persistCheckoutCart(state.cart)`.
- `persistCheckoutCart` stores only `{ product, quantity }` (no `status`), so rehydration in `src/pages/CheckoutPage.tsx:391` produces items with no `status`.
- In a partial failure scenario, `success` items are intentionally kept in the UI cart to avoid reprocessing. Refresh loses that signal and can re-enable reprocessing.

## Proposed Solutions

### Option 1: Persist Only Non-Success Items

**Approach:** In `CheckoutPage`, persist `state.cart.filter((i) => i.status !== 'success')`. Treat missing status as pending on hydration.

**Pros:**
- Minimal change, low surface area
- Aligns with current retry behavior (retry only failed/pending)
- Avoids the most likely duplicate-stock path

**Cons:**
- Refresh loses visibility of previously-successful items from the UI state (after partial failures)

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Persist Status (Normalized)

**Approach:** Extend persistence format to include `status` and `statusMessage`, normalizing `processing` to `idle` on hydration.

**Pros:**
- Preserves user-visible status across refresh
- Avoids duplicate retry of `success` items

**Cons:**
- Schema change requires version bump and migration logic
- More states to reason about; possible stale status UX

**Effort:** 1-2 hours

**Risk:** Medium

---

### Option 3: Clear Persistence At Checkout Start, Re-Persist Only Failed Items On Completion

**Approach:** When checkout starts, clear persisted cart and stop persisting until completion. On partial failure, persist only failed items.

**Pros:**
- Strongly reduces duplicate processing risk
- Keeps retry cart focused on actionable items

**Cons:**
- Refresh during checkout loses cart state (may be acceptable)

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Persist only non-`success` cart items so a refresh cannot re-enable processing of previously-successful items.

## Technical Details

**Affected files:**
- `src/pages/CheckoutPage.tsx:391` - rehydrate from persisted cart
- `src/pages/CheckoutPage.tsx:603` - persist effect
- `src/lib/checkoutCartStorage.ts` - persistence schema (if Option 2)

## Resources

- **Branch:** `codex/refresh-safe-routing-cart-persistence`
- **Commit:** `6154e3e`

## Acceptance Criteria

- [ ] If a checkout partially succeeds and the user refreshes `/checkout`, previously-success items are not retried automatically.
- [ ] Refresh-based cart restore still works for typical pre-checkout usage.
- [ ] Unit tests cover the chosen behavior (at least one test for partial-success persistence).
- [ ] E2E test covers the chosen behavior (or a clear rationale for unit-only coverage).

## Work Log

### 2026-02-12 - Initial Discovery

**By:** Codex

**Actions:**
- Identified persistence/rehydration mismatch (status not persisted) in `src/pages/CheckoutPage.tsx:391` and `src/pages/CheckoutPage.tsx:603`.
- Mapped failure scenario where refresh can re-enable processing of previously-successful items.

**Learnings:**
- Persistence is intentionally minimal (`{ product, quantity }`), which is fine for happy-path restore, but unsafe for partial-failure semantics.

---

### 2026-02-12 - Implemented Fix

**By:** Codex

**Actions:**
- Updated persistence to skip items with `status: 'success'` in `/Users/vladislavcaraseli/.codex/worktrees/18ab/inventory-app/src/lib/checkoutCartStorage.ts`.
- Added unit coverage in `/Users/vladislavcaraseli/.codex/worktrees/18ab/inventory-app/tests/unit/lib/checkoutCartStorage.test.ts`.
- Verified: `pnpm lint`, `pnpm test:unit`, `pnpm test:e2e`.

**Learnings:**
- Centralizing the rule in the storage helper avoids needing every caller to remember to filter.
