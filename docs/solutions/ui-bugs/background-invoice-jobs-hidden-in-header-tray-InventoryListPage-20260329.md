---
module: InventoryListPage
date: 2026-03-29
problem_type: ui_bug
component: page_component
symptoms:
  - "Closing the invoice dialog showed a short 'processing in background' toast, but users could not tell where to watch progress next."
  - "Completed background invoice jobs were easy to miss because the only durable UI lived in the header tray."
  - "Users reported that 'nothing happens' after the dialog closes, even when polling continued and the job later became ready."
root_cause: logic_error
resolution_type: refactor
severity: high
tags: [invoice-import, background-jobs, inventory-page, review-flow, ux]
related_github_issue: null
commit: ff5dead
---

# Problem Description

Invoice extraction was moved out of the upload dialog so long-running OCR work could continue after the modal closed. The implementation kept the job alive correctly, but the only durable UI for that background work was a small header tray. In practice, users saw a toast, closed the dialog, and then lost the thread because the app did not show a persistent on-page progress surface.

# Symptoms

- Uploading an invoice showed `Invoice processing in background`, then the dialog closed.
- The inventory page did not visibly change after that handoff.
- Users had to discover the header tray on their own to find `Processing` or `Review`.
- Route changes were safe because state lived above the page, but the UX still felt like progress disappeared.

# Root Cause Analysis

The technical fix for dialog-owned polling was only half the problem. Ownership moved from the modal to the app-level background jobs store, but visibility still depended on a secondary UI surface.

Before the fix, the page-level handoff looked like this:

```tsx
const handlePendingInvoiceJob = useCallback((result, file) => {
  registerPendingJob({
    jobId: result.jobId,
    fileName: file.name,
    statusUrl: result.statusUrl,
    retryAfterSeconds: result.retryAfterSeconds,
    backendStatus: result.jobStatus,
  });
  setInvoiceDialogOpen(false);
  showToast(
    'info',
    t('invoiceUpload.tray.backgroundTitle', 'Invoice processing in background'),
    t('invoiceUpload.tray.backgroundDescription', {
      fileName: file.name,
      defaultValue: '{{fileName}} will appear in the background jobs tray when review is ready.',
    }),
    5000,
  );
}, [registerPendingJob, showToast, t]);
```

That logic was correct in a state-management sense, but weak in a UX sense:

- the toast disappeared
- the tray lived outside the user’s current focus area
- there was no inline status transition from `Processing` to `Ready to review`

The background system worked, but the information architecture made it feel broken.

# Solution

Make the inventory page itself the primary background-jobs surface.

The fix introduced a dedicated inline panel directly under `Filters & Actions` and above the products table. The panel renders live job state from the existing `useInvoiceBackgroundJobs()` store and keeps the tray as a backup surface instead of the only one.

```tsx
const {
  jobs: invoiceJobs,
  registerPendingJob,
  reviewSession,
  dismissJob,
  openReviewSession,
  clearReviewSession,
} = useInvoiceBackgroundJobs();

// ...

<InvoiceJobsPanel
  jobs={invoiceJobs}
  onReview={openReviewSession}
  onDismiss={dismissJob}
/>
```

The handoff was also simplified so closing the dialog no longer depends on a toast to explain where the job went:

```tsx
const handlePendingInvoiceJob = useCallback((result, file) => {
  registerPendingJob({
    jobId: result.jobId,
    fileName: file.name,
    statusUrl: result.statusUrl,
    retryAfterSeconds: result.retryAfterSeconds,
    backendStatus: result.jobStatus,
  });
  setInvoiceDialogOpen(false);
}, [registerPendingJob]);
```

The new panel shows:

- processing jobs with file name, spinner, and backend status
- ready jobs with a visible `Review` CTA
- failed jobs with error text and `Dismiss`
- a summary badge so users can see at a glance whether work is still running

This preserves the existing reopen behavior while moving status feedback into the exact place users already look after closing the dialog.

# Files Changed

- `src/pages/InventoryListPage.tsx`
- `src/components/invoice/InvoiceJobsPanel.tsx`
- `tests/unit/components/invoice/InvoiceJobsPanel.test.tsx`
- `docs/mockups/invoice-background-jobs-inline-panel.html`

# Prevention

- Treat long-running workflows as page-level or app-level UI, not modal-only UI.
- When moving async work out of a dialog, move the status surface too; otherwise the feature is technically durable but experientially invisible.
- Add UI verification for all three states: `processing`, `ready`, and `failed`.
- Keep secondary surfaces like trays or toasts as backup affordances, not the only source of truth for important async work.

Related docs:

- [docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md)
- [docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md)
- [docs/plans/2026-03-28-001-feat-invoice-background-jobs-tray-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-28-001-feat-invoice-background-jobs-tray-plan.md)
