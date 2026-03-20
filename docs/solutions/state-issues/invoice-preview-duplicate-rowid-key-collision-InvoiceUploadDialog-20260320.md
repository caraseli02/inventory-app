---
module: InvoiceUploadDialog
date: 2026-03-20
problem_type: state_issue
component: dialog_component
symptoms:
  - "Removing one preview row also removed/affected a different row with the same OCR rowId"
  - "Update/Skip selection applied to the wrong row when OCR rowId values were duplicated"
  - "React reconciliation broke due to duplicate key props in the preview table"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [invoice-preview, invoice-ocr, rowid, previewid, react-keys, state-collision]
related_github_issue: 119
commit: null
---

# Problem Description

Invoice OCR can return duplicate `rowId` values. The invoice preview UI used `rowId` to build `previewId`, and `previewId` is used for React row keys and per-row state maps. When two rows shared the same `previewId`, their UI state collided.

# Symptoms

- Two extracted products appeared, but removing/updating one would remove/update the other (same `rowId`).
- Per-row selection (e.g., `Skip` vs `Update`) “jumped” to the sibling row.
- React emitted duplicate key warnings (`Encountered two children with the same key`) and reconciliation became unstable.

# Root Cause Analysis

`getPreviewId()` returned `row:${rowId}` when `rowId` existed, with no uniqueness tiebreaker. All row-level state was keyed by `previewId` (including React `key`, `importActions`, `removedPreviewIds`, and manual overrides), so duplicate OCR `rowId` meant two logical rows shared one identity.

```ts
// ❌ BEFORE
const rowId = product.rowId?.trim();
if (rowId) return `row:${rowId}`;
return `idx:${index}`;
```

# Solution

Make `previewId` unconditionally unique by adding an index tiebreaker when `rowId` exists.

```ts
// ✅ AFTER
const rowId = product.rowId?.trim();
if (rowId) return `row:${rowId}:idx:${index}`;
return `idx:${index}`;
```

This keeps rows distinct even when OCR duplicates `rowId`, preventing state-map collisions and duplicate React keys.

# Files Changed

- `src/hooks/useInvoiceImport.helpers.ts` (unique `previewId` generation)
- `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx` (regression: duplicate `rowId` remove isolation)
- `tests/e2e/invoice-duplicate-rowid.spec.ts` (Playwright regression: duplicate `row_id` remove isolation + no duplicate-key warnings)

# Verification

- Unit: `pnpm vitest run tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx`
- E2E: `pnpm test:e2e -- tests/e2e/invoice-duplicate-rowid.spec.ts`
- Types: `pnpm typecheck`

# Prevention

- Treat OCR `rowId` as **untrusted/non-unique**; never key UI state solely by it.
- Keep a regression test that uses a synthetic OCR response with duplicate `row_id` and asserts:
  - removing one row doesn’t remove its sibling
  - FX recompute doesn’t resurrect/remove the wrong row
  - no duplicate React key warnings
- Follow-up risk: pricing + “already imported” logic still keys off `rowId`/`row_id` (see `todos/030-pending-p2-duplicate-ocr-rowid-breaks-pricing-idempotency.md`).

# Related

- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md` (row identity + removals precedent)
- `todos/027-pending-p2-preview-id-collision-on-duplicate-rowid.md` (tracking + acceptance criteria)
- `todos/030-pending-p2-duplicate-ocr-rowid-breaks-pricing-idempotency.md` (follow-up collision risk outside UI keys)
- `docs/specs/invoice-import-api-contract.md` (server contract context for `row_id`)

