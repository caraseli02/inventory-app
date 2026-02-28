---
status: complete
priority: p3
issue_id: "065"
tags: [code-review, quality, react, checkout, maintainability]
dependencies: []
---

# Prune unused Checkout reducer state and actions

Checkout refactor extracted logic to `useCheckout`, but `checkoutReducer` still carries dead fields/actions that are no longer read or dispatched. This increases reducer surface area and future maintenance cost.

## Problem Statement

`checkoutReducer` includes state fields and actions with no callsites after PR #143. Keeping dead state in a central reducer makes future changes riskier and obscures true page state.

## Findings

- Unused reducer state fields: `showScanner`, `showConfirmDialog`, `confirmDialogMessage` in `src/components/checkout/checkoutReducer.tsx`.
- Unused reducer actions: `TOGGLE_SCANNER`, `SET_SHOW_SCANNER`, `SHOW_CONFIRM_DIALOG` are defined but never dispatched.
- `HIDE_CONFIRM_DIALOG` is dispatched in `src/hooks/useCheckout.ts` but no confirm dialog is rendered in `src/pages/CheckoutPage.tsx`.
- Dead branches remain in reducer switch (`checkoutReducer.tsx` cases for the actions above).

## Proposed Solutions

### Option 1: Remove dead state/actions now

**Approach:** Delete unused fields/actions/cases, and remove `HIDE_CONFIRM_DIALOG` dispatch in `runCheckout`.

**Pros:**
- Smaller reducer API
- Clearer state model
- Less accidental coupling for future work

**Cons:**
- Minor refactor effort
- Requires updating any tests typed against old action union

**Effort:** Small

**Risk:** Low

---

### Option 2: Keep but mark deprecated with TODO + sunset date

**Approach:** Keep current shape but add explicit deprecation comments and ticket link.

**Pros:**
- Zero behavior risk
- Minimal immediate change

**Cons:**
- Dead code remains
- Future contributors can still rely on deprecated paths

**Effort:** Small

**Risk:** Low

## Recommended Action

Use Option 1. Remove dead reducer API in the same branch or immediate follow-up PR.

## Technical Details

Affected files:
- `src/components/checkout/checkoutReducer.tsx`
- `src/hooks/useCheckout.ts`

## Resources

- PR: https://github.com/caraseli02/inventory-app/pull/143

## Acceptance Criteria

- [x] `checkoutReducer` no longer defines unused state fields/actions listed above
- [x] `useCheckout` no longer dispatches `HIDE_CONFIRM_DIALOG`
- [x] Typecheck and lint pass
- [x] Checkout flow behavior unchanged (scan, add, review, confirm)

## Work Log

### 2026-02-28 - Code review capture

**By:** Codex

**Actions:**
- Reviewed PR #143 refactor extraction files.
- Cross-checked reducer fields/actions against callsites with `rg`.
- Recorded dead-state cleanup as follow-up todo.

**Learnings:**
- Refactor substantially improved page size/readability.
- Remaining dead action branches are low risk to remove and worth cleanup.

### 2026-02-28 - Implementation + closure

**By:** Codex

**Actions:**
- Removed unused reducer fields/actions/cases from `src/components/checkout/checkoutReducer.tsx`.
- Removed stale `HIDE_CONFIRM_DIALOG` dispatch from `src/hooks/useCheckout.ts`.
- Ran `pnpm lint` and `pnpm typecheck` successfully.
- Marked this todo as complete and renamed file to complete status.

**Learnings:**
- Reducer API now matches actual checkout UI flow and is easier to maintain.
