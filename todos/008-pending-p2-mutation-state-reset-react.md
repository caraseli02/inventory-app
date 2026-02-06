---
status: pending
priority: p2
issue_id: "008"
tags: [react, state-management, ux]
dependencies: []
---

# Problem Statement

BatchDeleteConfirmDialog doesn't reset TanStack Query mutation state when the dialog is manually closed after a partial failure, potentially leaving the mutation in an inconsistent state if the dialog is reopened.

**Impact:** Minor UX issue where mutation state (isPending, error) persists when dialog is reopened after partial failure and manual close.

## Findings

### Root Cause Analysis

**Location:** `src/components/product/BatchDeleteConfirmDialog.tsx:86-89`

```tsx
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setConfirmed(false);
    setFailedDeletions([]);
    // ❌ Missing: mutation.reset()
  }
  onOpenChange(newOpen);
};
```

**Why it's incomplete:**
- `confirmed` state is reset ✅
- `failedDeletions` state is reset ✅
- `mutation` state is NOT reset ❌
- TanStack Query mutation persists with previous state

### Scenario Where It Matters

1. User selects 10 products
2. Clicks "Delete Selected"
3. Confirms deletion
4. 5 products succeed, 5 fail (partial failure)
5. Dialog stays open showing failures (correct behavior)
6. User clicks "Cancel" to close dialog
7. User reopens dialog with same or different products
8. Mutation state still shows previous partial failure

**Current state after step 6:**
- `mutation.isSuccess` = false
- `mutation.isError` = false (Promise.allSettled doesn't fail)
- `mutation.data` = contains previous results
- `mutation.variables` = contains previous product list

### Impact Assessment

| Impact | Severity | Likelihood | Risk Score |
|--------|----------|------------|------------|
| Stale mutation state | 🟡 Low | Low | 2/10 |
| UI inconsistency | 🟡 Low | Low | 2/10 |
| User confusion | 🟡 Low | Very Low | 1/10 |

**Overall Risk Score: 5/30** - Very low priority improvement

**Why low priority:**
- TanStack Query handles stale state gracefully
- Dialog state (confirmed, failedDeletions) is reset correctly
- Only mutation internal state persists
- Unlikely to cause user-visible issues

## Solution

Call `mutation.reset()` in `handleOpenChange` when closing the dialog to clear all mutation state.

### Implementation

```tsx
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) {
    setConfirmed(false);
    setFailedDeletions([]);
    mutation.reset(); // ✅ Add this line
  }
  onOpenChange(newOpen);
};
```

**What `mutation.reset()` does:**
- Clears `mutation.data`
- Clears `mutation.error`
- Resets `mutation.isSuccess`, `mutation.isError`, `mutation.isPending` to false
- Clears `mutation.variables`
- Returns mutation to initial idle state

## Implementation Plan

1. **Update BatchDeleteConfirmDialog.tsx**
   - Add `mutation.reset()` call in `handleOpenChange` when dialog closes
   - Place after `setConfirmed(false)` and `setFailedDeletions([])`

2. **Verify no side effects**
   - Test dialog open/close cycles
   - Test partial failure scenarios
   - Verify mutation state resets correctly

## Testing

**Manual Test Scenario 1: Partial Failure Handling**
1. Select 10 products
2. Click "Delete Selected", confirm
3. Wait for partial failure (5 succeed, 5 fail)
4. Dialog shows 5 failures
5. Click "Cancel" to close
6. Reopen dialog with same products
7. Verify no stale state from previous attempt

**Manual Test Scenario 2: Full Success**
1. Select 5 products
2. Click "Delete Selected", confirm
3. All succeed, dialog auto-closes
4. Reopen dialog with different products
5. Verify clean state

**Expected:** No behavior change in normal flows, just cleaner state management

## References

- **TanStack Query Mutations**: https://tanstack.com/query/latest/docs/react/guides/mutations
- **Mutation Reset**: https://tanstack.com/query/latest/docs/react/reference/useMutation#mutationreset
- **PR Review Finding**: Error handling review identified potential state inconsistency
