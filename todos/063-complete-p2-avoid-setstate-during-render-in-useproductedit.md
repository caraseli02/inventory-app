---
status: complete
priority: p2
issue_id: "063"
tags: [code-review, react, reliability, typescript]
dependencies: []
---

# Move useProductEdit reset out of render

Replace render-phase state updates with an effect-based reset when product changes.

## Problem Statement

`useProductEdit` updates local state during render when `product.id` changes. This pattern is fragile in React concurrent rendering and makes state flow harder to reason about.

## Findings

- `src/hooks/useProductEdit.ts:126` checks `product.id !== trackedProductId` inside render.
- `src/hooks/useProductEdit.ts:127-129` calls `setTrackedProductId` and `setFormData` during render.
- This can trigger extra render passes and is discouraged by React guidance.

## Proposed Solutions

### Option 1: Use effect-driven reset

**Approach:** Replace render-phase block with `useEffect(() => { ... }, [product.id])`.

**Pros:**
- React-idiomatic
- Safer under Strict/Concurrent rendering

**Cons:**
- Requires careful initial render behavior check

**Effort:** 30-60 minutes

**Risk:** Low

---

### Option 2: Keyed remount at caller

**Approach:** In `EditProductDialog`, key the form subtree by `product.id` and remove tracked ID state.

**Pros:**
- Simpler hook internals
- Guaranteed clean state per product

**Cons:**
- Resets all transient UI state unconditionally
- Wider component impact

**Effort:** 45-90 minutes

**Risk:** Medium

---

### Option 3: useReducer with explicit RESET action

**Approach:** Manage form state with reducer; dispatch reset on product change in effect.

**Pros:**
- Explicit transitions
- Scales for future complexity

**Cons:**
- More code than needed now

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Done: Option 1 implemented by moving product-change reset into effects and removing render-phase state updates.

## Technical Details

**Affected files:**
- `src/hooks/useProductEdit.ts`
- `src/components/product/EditProductDialog.tsx` (verify no behavior drift)

**Related components:**
- `EditProductDialog`
- `useProductEdit`

**Database changes (if any):**
- No

## Resources

- **PR:** #140
- **PR URL:** https://github.com/caraseli02/inventory-app/pull/140

## Acceptance Criteria

- [x] No `setState` calls inside render path in `useProductEdit`
- [x] Form resets correctly when dialog switches to another product
- [x] Unsaved-change detection still works
- [x] `pnpm lint` passes
- [x] `pnpm typecheck` passes

## Work Log

### 2026-02-27 - Review finding captured

**By:** Codex

**Actions:**
- Reviewed extracted `useProductEdit` hook in PR #140.
- Identified render-phase state update pattern.
- Documented remediation options and validation checklist.

**Learnings:**
- Extracting logic into hooks is a good chance to remove legacy render-time state transitions.

### 2026-02-27 - Fix implemented and verified

**By:** Codex

**Actions:**
- Removed render-phase reset logic from `src/hooks/useProductEdit.ts`.
- Added effect-based reset keyed by `product.id`.
- Added effect to synchronize latest `product` value for reset calculation.
- Ran `pnpm lint` and `pnpm typecheck`.

**Learnings:**
- Effect-based reset keeps behavior while avoiding render-time state transitions.

## Notes

- Not a merge blocker today; tracked as `p2` reliability/maintainability follow-up.
