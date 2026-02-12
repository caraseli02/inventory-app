---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, react, typescript, reliability]
dependencies: []
---

# Remove `onCheckout!` Non-Null Assertion In Cart Component

## Problem Statement

`Cart` accepts `onCheckout?: () => void`, but passes `onCheckout!` to `CartFooter`. If a caller renders `Cart` without `customFooter` and forgets to pass `onCheckout`, this becomes a runtime crash.

## Findings

- `src/components/cart/Cart.tsx:112` uses `onCheckout={onCheckout!}` while `onCheckout` is typed as optional.
- The type system currently permits an invalid prop combination (no `customFooter`, no `onCheckout`).

## Proposed Solutions

### Option 1: Make `onCheckout` Required When `customFooter` Is Not Provided

**Approach:** Change `CartProps` to a discriminated union:
- Variant A: `{ customFooter?: undefined; onCheckout: () => void; ... }`
- Variant B: `{ customFooter: ReactNode; onCheckout?: never; ... }`

**Pros:**
- Eliminates runtime crash path
- Enforces correct usage at compile time

**Cons:**
- Requires updating callers if any rely on the unsafe combination

**Effort:** 20-45 minutes

**Risk:** Low

---

### Option 2: Provide A Safe No-Op Fallback

**Approach:** Pass `onCheckout={() => {}}` when missing and optionally log a warning in development.

**Pros:**
- No caller changes required

**Cons:**
- Silent failure can hide bugs in flows that depend on checkout

**Effort:** 10-20 minutes

**Risk:** Medium

## Recommended Action

Model `Cart` props as a discriminated union so `onCheckout` is required only when `customFooter` is not provided, removing the unsafe `onCheckout!` assertion.

## Technical Details

**Affected files:**
- `src/components/cart/Cart.tsx:11`

## Resources

- **Branch:** `codex/refresh-safe-routing-cart-persistence`
- **Commit:** `6154e3e`

## Acceptance Criteria

- [ ] TypeScript prevents rendering `Cart` without a valid checkout action.
- [ ] No `!` assertions are required for `onCheckout`.
- [ ] Existing cart callers are updated and tests still pass.

## Work Log

### 2026-02-12 - Initial Discovery

**By:** Codex

**Actions:**
- Identified unsafe non-null assertion `onCheckout!` in `src/components/cart/Cart.tsx:112`.

**Learnings:**
- Optional props that are required in some render branches should be modeled as a discriminated union.

---

### 2026-02-12 - Implemented Fix

**By:** Codex

**Actions:**
- Updated `CartProps` to a discriminated union and removed `onCheckout!` in `/Users/vladislavcaraseli/.codex/worktrees/18ab/inventory-app/src/components/cart/Cart.tsx`.
- Verified: `pnpm lint`, `pnpm test:unit`, `pnpm test:e2e`.

**Learnings:**
- This prevents a whole class of runtime crashes by forcing valid prop combinations at compile time.
