---
status: pending
priority: p2
issue_id: "027"
tags: [code-review, reliability, invoice-ocr, ui-state]
dependencies: []
---

# Preview ID collisions can misapply actions/removals

## Problem Statement

Invoice preview row identity now depends on `rowId` when present. If OCR yields duplicate or non-unique `rowId` values, state keyed by `previewId` collides and user actions can apply to the wrong row.

## Findings

- Before fix: `getPreviewId` returned `row:${rowId}` directly when `rowId` exists, without uniqueness guard by index.
- `importActions` and `removedPreviewIds` are keyed by this `previewId`, so collisions merge state across rows.
- `TableRow` key also uses `previewId`, so duplicate keys can cause unstable React reconciliation.
- Evidence:
- `src/hooks/useInvoiceImport.helpers.ts:51`
- `src/hooks/useInvoiceImport.ts:36`
- `src/hooks/useInvoiceImport.ts:43`
- `src/hooks/useInvoiceImport.ts:192`
- `src/components/invoice/InvoicePreviewTable.tsx:118`

## Proposed Solutions

### Option 1: Make preview IDs unconditionally unique

**Approach:** Build ID as `row:${rowId}:idx:${index}` when rowId exists; keep `idx:${index}` fallback.

**Pros:** Prevents collisions in all state maps and React keys.

**Cons:** If row ordering changes, identity changes with index.

**Effort:** Small

**Risk:** Low

---

### Option 2: Add collision-safe UID map at ingest

**Approach:** Generate UUID per row once on upload and carry it through all transformations, independent of rowId/index.

**Pros:** Fully stable identity even if rows reorder.

**Cons:** Slightly more wiring through mapping code.

**Effort:** Medium

**Risk:** Low

## Recommended Action

Implement Option 1 (unique tiebreaker): `row:${rowId}:idx:${index}` and add a regression test for duplicate-rowId removal isolation.


## Technical Details

**Affected files:**
- `src/hooks/useInvoiceImport.helpers.ts`
- `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx`

## Resources

- PR #110
- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md` (precedent; original `previewId` intro)
- `todos/013-complete-p2-import-action-index-shift.md` (state drift precedent)
- `todos/014-complete-p2-removed-items-return-on-fx-change.md` (FX recompute + removals precedent)
- `docs/specs/invoice-import-api-contract.md` (server contract implies `row_id` uniqueness)

## Acceptance Criteria

- [ ] Preview row key is unique for every row, even with duplicate `rowId`
- [ ] Removing one of duplicate-rowId rows does not remove siblings
- [ ] Per-row `update/skip` selection remains isolated with duplicate-rowId input
- [ ] Manual QA with synthetic duplicate row IDs passes

## Work Log

### 2026-02-16 - Initial discovery

**By:** Codex

**Actions:**
- Reviewed PR #110 row identity strategy and state keying.
- Identified collision risk where OCR emits duplicate `rowId` values.

**Learnings:**
- Stable IDs also need uniqueness guarantees; a trusted external row ID is insufficient without deduping.

### 2026-03-20 - Implemented fix + regression test

**By:** Codex

**Actions:**
- Updated `getPreviewId` to include an index tiebreaker for `rowId` rows.
- Added unit test covering duplicate `rowId` + remove + FX recompute.
- Added Playwright E2E test covering duplicate `row_id` + remove + FX recompute.
- Verified: `pnpm vitest run tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx` and `pnpm typecheck`.
  - Verified: `pnpm test:e2e -- tests/e2e/invoice-duplicate-rowid.spec.ts`

**Learnings:**
- Index tiebreaker is sufficient as long as the index is derived from the raw OCR row list (not the filtered preview list).

## Notes

- This is a correctness/reliability issue and should be resolved before relying on row-level action persistence at scale.
