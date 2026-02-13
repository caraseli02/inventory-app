---
module: BatchDeleteConfirmDialog
date: 2026-02-13
problem_type: state_issue
component: dialog_component
symptoms:
  - "Reopening batch delete dialog can show stale deletion state/results"
  - "Checkbox handler typed as boolean even though Radix can emit indeterminate"
  - "Batch deletion failures are hard to debug because per-item failures are not logged"
  - "Large batch deletions provide no operator guidance and can fail due to backend limits"
root_cause: missing_cleanup
resolution_type: code_fix
severity: medium
tags: [batch-delete, dialog, mutation, radix-checkbox, logging, observability]
related_github_issue: null
commit: 37332778f3604cef198ec4b1263a5d9a61fddb13
---

# Problem Description

Batch product deletion is handled in `BatchDeleteConfirmDialog`. After partial failures and manual dialog close, reopening could carry stale mutation state. Separately, per-item failures were only surfaced in UI (not logs), and the confirmation checkbox handler assumed `boolean` even though Radix Checkbox can emit an indeterminate state.

# Symptoms

- Close the dialog after a partial failure, reopen: prior mutation state can persist.
- Batch delete failures have no per-product log record (id/name/error) for debugging.
- Confirmation checkbox uses `onCheckedChange((checked: boolean) => ...)`, which is too narrow.
- Deleting many products at once can trigger backend limits without any warning.

# Root Cause Analysis

The dialog reset logic cleared local React state (`confirmed`, `failedDeletions`) but did not reset the TanStack Query mutation state on close. That leaves previous mutation results/errors attached to the hook instance.

```tsx
// ❌ BEFORE - dialog close resets local state only
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setConfirmed(false);
    setFailedDeletions([]);
    // missing: mutation.reset()
  }
  onOpenChange(newOpen);
};
```

# Solution

1. Reset mutation state when the dialog closes (`mutation.reset()`).
2. Treat Radix Checkbox `CheckedState` correctly by using `checked === true`.
3. Log individual deletion failures as they’re detected in the `Promise.allSettled` result loop.
4. Add a warning UI for large batches (warning-only; no throttling in MVP).

```tsx
// ✅ AFTER - close resets local state and mutation state
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setConfirmed(false);
    setFailedDeletions([]);
    mutation.reset();
  }
  onOpenChange(newOpen);
};

// ✅ AFTER - Radix CheckedState support
<Checkbox onCheckedChange={(checked) => setConfirmed(checked === true)} />
```

# Files Changed

- `src/components/product/BatchDeleteConfirmDialog.tsx`

# Prevention

- Prefer stable state resets for dialogs: reset both local UI state and `useMutation` state on close.
- When using Radix primitives, avoid narrowing callback types; handle `CheckedState` explicitly.
- When doing batch operations, log per-item failures with enough identifiers to debug quickly.
- Add operator-facing warnings for operations likely to hit backend limits (even if MVP doesn’t implement throttling yet).

