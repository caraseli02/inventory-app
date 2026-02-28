---
module: CheckoutFlow
date: 2026-02-28
problem_type: developer_experience
component: utility
symptoms:
  - "Checkout reducer contained state fields/actions with no remaining callsites after extracting useCheckout"
  - "Hook still dispatched HIDE_CONFIRM_DIALOG even though confirm dialog UI no longer existed"
  - "Reducer API surface was larger than actual runtime behavior, increasing maintenance noise"
root_cause: logic_error
resolution_type: refactor
severity: low
tags: [checkout, reducer, dead-code, refactor, maintainability, react]
related_github_issue: null
commit: null
---

# Problem Description

After extracting checkout logic from `CheckoutPage` into `useCheckout` + subcomponents, legacy reducer fields and actions remained in `checkoutReducer.tsx`.

This did not break runtime behavior, but it left dead state transitions that no longer matched the actual UI flow.

# Symptoms

- `checkoutReducer` still defined `showScanner`, `showConfirmDialog`, and `confirmDialogMessage`.
- Action union still included `TOGGLE_SCANNER`, `SET_SHOW_SCANNER`, `SHOW_CONFIRM_DIALOG`, `HIDE_CONFIRM_DIALOG`.
- `runCheckout` in `useCheckout.ts` still dispatched `HIDE_CONFIRM_DIALOG` while `CheckoutPage` rendered only `CheckoutReviewModal`.

# Root Cause Analysis

Refactor extraction removed the confirm-dialog and scanner-toggle paths from the page UI, but reducer cleanup was only partial.

```typescript
// ❌ BEFORE
// checkoutReducer.tsx
showScanner: boolean;
showConfirmDialog: boolean;
confirmDialogMessage: string;

| { type: 'TOGGLE_SCANNER' }
| { type: 'SET_SHOW_SCANNER'; show: boolean }
| { type: 'SHOW_CONFIRM_DIALOG'; message: string }
| { type: 'HIDE_CONFIRM_DIALOG' }

// useCheckout.ts
dispatch({ type: 'HIDE_CONFIRM_DIALOG' });
```

The mismatch created dead branches and misleading state shape, making future edits riskier.

# Solution

Pruned dead reducer API and removed stale dispatch:

```typescript
// ✅ AFTER
// checkoutReducer.tsx
// removed fields: showScanner, showConfirmDialog, confirmDialogMessage
// removed actions/cases: TOGGLE_SCANNER, SET_SHOW_SCANNER, SHOW_CONFIRM_DIALOG, HIDE_CONFIRM_DIALOG

// useCheckout.ts
// removed stale dispatch({ type: 'HIDE_CONFIRM_DIALOG' })
```

This aligned reducer state transitions with the current checkout UX (scan/search, review modal, confirm).

# Files Changed

- `src/components/checkout/checkoutReducer.tsx`
- `src/hooks/useCheckout.ts`

# Verification

- `pnpm lint`
- `pnpm typecheck`

Both passed after cleanup.

# Prevention

- [x] During extraction refactors, remove obsolete state fields/actions in the same PR.
- [x] Validate reducer action unions against actual dispatch callsites (`rg` check).
- [ ] Add a lightweight CI check/script to report reducer actions with zero dispatch references.
- [ ] Add review checklist item: "Does state shape still match rendered UI paths?"

# Related

- `todos/065-complete-p3-prune-unused-checkout-reducer-actions.md`
- PR: `#143` (`refactor/allowlist-checkout`)
