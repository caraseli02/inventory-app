---
module: ProductImportUI
date: 2026-03-29
problem_type: state_issue
component: dialog_component
symptoms:
  - "Excel import dialog advanced to complete after partial imports"
  - "Invoice import dialog showed success even when failed rows or fatal import errors existed"
  - "Resolved onImport promises were treated as full success regardless of ImportResult contents"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [import-ui, excel-import, invoice-import, dialog-state, partial-failure, fatal-error, completion-state]
related_github_issue: null
commit: null
---

# Problem Description

The shared import UI contract was too weak. Both Excel and invoice dialogs treated a resolved `onImport()` promise as a successful business outcome, even though the underlying import runners already returned structured failure state (`fatalError`, `errorCount`, `partialProducts`).

That meant the UI could move to a "complete" step after a partial import, or after a runner-reported fatal stop, hiding failed rows behind success copy.

# Symptoms

- Excel import could finish on the success screen even when some rows failed or stock movement writes were partial.
- Invoice confirm import could also advance to `complete` after mixed-result imports.
- Success copy used the parsed row count instead of the actual runner success count.
- Users had to rely on toast text to detect failures; the dialog state itself implied everything succeeded.

# Root Cause Analysis

The bug was not in row execution. It was in the UI outcome boundary.

`onImport()` was modeled as `Promise<void>`, so dialogs treated promise resolution as equivalent to success:

```ts
// ❌ BEFORE
await onImport(importResult.products);
setStep('complete');
```

```ts
// ❌ BEFORE
await onImport(imported, onProgress);
setStep('complete');
```

But the import runners already used a richer outcome model:

- `fatalError`
- `errorCount`
- `failedProducts`
- `partialProducts`

Those outcomes were surfaced in toasts, but not used to drive dialog state. So the transport-level contract ("promise resolved") overrode the business-level contract ("import had warnings/failures").

# Solution

## 1) Make the import contract explicit

Updated `useProductImport()` to return `Promise<ImportResult>` instead of `Promise<void>`.

```ts
// ✅ AFTER
const handleImport = async (...): Promise<ImportResult> => {
  const result = await runXlsxImport(...);
  return result;
};
```

This makes partial and fatal outcomes available to every caller instead of burying them behind toasts only.

## 2) Gate dialog completion on `ImportResult`

The Excel dialog now inspects the runner result before moving to `complete`:

```ts
// ✅ AFTER
const result = await onImport(products, onProgress);
setCompletedImportResult(result);

if (result.fatalError) {
  setImportErrors([result.fatalError]);
  setStep('preview');
  return;
}

if (result.errorCount > 0 || result.partialProducts.length > 0) {
  setImportErrors([...failedProducts, ...partialProducts]);
  setStep('preview');
  return;
}

setStep('complete');
```

The complete screen also uses `completedImportResult.successCount` instead of parsed-row count.

## 3) Align the invoice path with the same rule

Updated the invoice dialog prop types and `useInvoiceConfirmImport()` so invoice completion is also based on `ImportResult`, not promise settlement alone.

That keeps both import flows consistent:

- clean import -> `complete`
- partial/fatal import -> stay in `preview` and surface actionable errors

# Files Changed

- `src/hooks/useProductImport.ts`
- `src/components/xlsx/ImportDialog.tsx`
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/hooks/useInvoiceConfirmImport.ts`
- `src/hooks/useInvoiceImport.types.ts`
- `src/lib/importRunnerTypes.ts`

# Why This Works

It restores the correct boundary:

- promise resolution means "the import attempt finished"
- `ImportResult` means "what business outcome actually happened"

The UI now renders completion from the second signal, not the first.

This prevents false-success states whenever imports can partially succeed, partially fail, or stop after some rows already processed.

# Validation

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:run src/lib/__tests__/excelImportIdempotency.test.ts src/lib/__tests__/xlsxPreview.test.ts src/lib/__tests__/xlsxParser.test.ts src/lib/__tests__/importRunners.xlsx.test.ts`
- Headless browser verification on `/inventory` confirmed the `Import Excel` dialog still opens correctly

# Prevention

- [ ] Treat import completion as structured outcome data, not promise control flow
- [ ] Prefer typed result objects for bulk operations that can partially succeed
- [ ] Add component tests that assert dialogs do not enter `complete` when `errorCount > 0`, `partialProducts.length > 0`, or `fatalError` exists
- [ ] Centralize result-to-UI mapping for import flows so Excel and invoice paths cannot drift again

# Related

- [docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md)
- [docs/solutions/logic-errors/same-invoice-fx-reupload-false-update-defaults-InvoiceUploadDialog-20260225.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/same-invoice-fx-reupload-false-update-defaults-InvoiceUploadDialog-20260225.md)
- [docs/solutions/logic-errors/invoice-import-name-dedup-override-InvoiceImport-20260225.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/invoice-import-name-dedup-override-InvoiceImport-20260225.md)
- `todos/018-complete-p3-import-progress-clarity-and-i18n.md`

# Refresh Follow-up

Possible narrow follow-up: `ce:compound-refresh mdl-prices-treated-as-eur-InvoiceUploadDialog-20260206`

That older learning predates the current import outcome contract and may now read as if import completion is still fire-and-forget.
