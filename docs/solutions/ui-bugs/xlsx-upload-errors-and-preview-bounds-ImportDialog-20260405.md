---
module: ImportDialog
date: 2026-04-05
problem_type: ui_bug
component: dialog_component
symptoms:
  - "Fatal XLSX parse errors were shown only in English on the upload step for non-English locales"
  - "Invalid file type errors bypassed the XLSX translation metadata path"
  - "Large XLSX previews mounted every row in the dialog at once after the 10-row cap was removed"
  - "The canonical Excel fallback lost the planned bounded-rendering guardrail for large supplier workbooks"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [xlsx-import, import-ui, i18n, pagination, performance, preview]
related_github_issue: null
commit: null
---

# Problem Description

The April 5 XLSX readiness work improved parser metadata and removed the old 10-row preview cap, but two UI-boundary gaps remained in `ImportDialog`.

Upload-step failures still rendered raw English text instead of the new translation metadata, and the preview now mounted every row plus a full action selector at once. That left localized users with untranslated fatal parse errors and made the canonical Excel fallback increasingly risky for larger supplier workbooks.

# Symptoms

- Non-English locales still saw English-only upload-step failures such as `Please select an Excel file (.xlsx or .xls)` and fatal parser errors before preview opened.
- The parser already emitted `messageKey` / `messageValues`, but those values were only used in preview mode.
- XLSX preview correctness was restored for rows beyond the first 10, but the dialog no longer had any explicit rendering bound for large imports.
- `docs/project-status.md` said parser validation was localized even though the upload-step error panel still bypassed the translation path.

# Root Cause Analysis

This was not a parser or runner bug. It was a dialog integration bug.

The parser and preview helpers had already moved to structured message metadata, but the upload-step render path still used the older raw-string contract:

```typescript
// ❌ BEFORE
errors: [{ row: 0, message: 'Please select an Excel file (.xlsx or .xls)' }]
```

```typescript
// ❌ BEFORE
{error.row > 0 && t('import.rowError', { row: error.row, message: error.message })}
{error.row === 0 && error.message}
```

At the same time, the first fix for “hidden actionable rows” removed the `slice(0, 10)` cap directly in the table:

```typescript
// ❌ BEFORE
{rows.slice(0, 10).map((row) => (
```

That solved reviewability, but it also removed the only preview rendering bound despite the active plan explicitly calling for large-import responsiveness to remain bounded.

# Solution

## 1) Reuse one localized message path for upload and preview failures

The upload-step invalid-file-type branch now emits the same structured error shape as parser failures, and the upload error panel resolves messages through the existing formatter.

```typescript
// ✅ AFTER
errors: [{
  row: 0,
  message: 'Please select an Excel file (.xlsx or .xls)',
  messageKey: 'import.errors.invalidFileType',
}]
```

```typescript
// ✅ AFTER
{error.row > 0 && t('import.rowError', { row: error.row, message: formatImportMessage(error) })}
{error.row === 0 && formatImportMessage(error)}
```

This finished the i18n contract started in `src/lib/xlsx/index.ts` and made upload/parser/preview validation consistent across supported locales.

## 2) Keep every XLSX row reachable without mounting the full batch at once

Instead of going back to truncation, `ImportDialog` now paginates preview rows in 50-row pages and keeps row action state in the parent dialog state.

```typescript
// ✅ AFTER
const totalPreviewPages = Math.max(1, Math.ceil(previewRows.length / XLSX_PREVIEW_PAGE_SIZE));
const previewSliceStart = safePreviewPage * XLSX_PREVIEW_PAGE_SIZE;
const visiblePreviewRows = previewRows.slice(previewSliceStart, previewSliceEnd);
```

```tsx
// ✅ AFTER
<ImportPreviewTable
  rows={visiblePreviewRows}
  t={t}
  onActionChange={handleActionChange}
/>
```

That preserves the “review before import” trust model from the row-visibility fix while restoring a rendering bound for large batches.

## 3) Add component coverage for the dialog boundary

The fix added `src/components/xlsx/__tests__/ImportDialog.test.tsx` to cover the exact surfaces that slipped:

- localized invalid file type errors during upload
- localized fatal parser errors before preview opens
- paginated large-batch previews instead of eager full-batch mounting

# Why This Works

1. **Localization is now end-to-end at the UI boundary.** The parser emits structured metadata, and every visible XLSX error surface in the dialog resolves through that contract.
2. **Reviewability and performance are no longer in conflict.** Users can still reach every row before confirm, but the DOM no longer scales linearly with the full workbook at first render.
3. **The highest-risk dialog boundary now has component coverage.** The new tests exercise the upload-step failure path and the large-preview path directly, not just the parser and runner helpers underneath.

# Files Changed

- `src/components/xlsx/ImportDialog.tsx`
- `src/components/xlsx/__tests__/ImportDialog.test.tsx`
- `src/locales/en.json`
- `src/locales/es.json`
- `src/locales/ro.json`
- `src/locales/ru.json`
- `docs/project-status.md`

# Validation

- `pnpm vitest run src/components/xlsx/__tests__/ImportDialog.test.tsx src/components/xlsx/__tests__/ImportPreviewTable.test.tsx src/lib/__tests__/xlsxParser.test.ts src/lib/__tests__/xlsxPreview.test.ts src/lib/__tests__/importRunners.xlsx.test.ts src/lib/__tests__/excelImportIdempotency.test.ts`
- `pnpm exec tsc --noEmit --pretty false`

Both passed.

# Prevention

- [x] Keep user-facing import copy on the UI/i18n boundary; helpers and parsers may emit metadata, but renderers must resolve it consistently.
- [x] When removing a correctness cap such as `slice(0, 10)`, replace it with another explicit bound if the active plan calls for bounded rendering.
- [x] Add dialog-level component tests for upload-step fatal failures and large-batch preview behavior when changing import flows.
- [x] Update `docs/project-status.md` only after the claimed UX path is actually wired end to end.

# Related Documentation

- [docs/solutions/state-issues/false-complete-after-partial-or-fatal-import-ProductImportUI-20260329.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/state-issues/false-complete-after-partial-or-fatal-import-ProductImportUI-20260329.md)
- [docs/solutions/ui-bugs/hardcoded-image-upload-error-text-useCreateProduct-20260227.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/ui-bugs/hardcoded-image-upload-error-text-useCreateProduct-20260227.md)
- `docs/plans/2026-03-29-001-feat-canonical-excel-delivery-import-plan.md`
- `todos/183-complete-p1-xlsx-preview-hides-actionable-rows.md`
- `todos/185-complete-p3-localize-xlsx-validation-and-blocking-errors.md`
