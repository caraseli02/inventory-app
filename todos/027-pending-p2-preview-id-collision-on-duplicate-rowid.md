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

- `getPreviewId` returns `row:${rowId}` directly when `rowId` exists, without uniqueness guard by index.
- `importActions` and `removedPreviewIds` are keyed by this `previewId`, so collisions merge state across rows.
- `TableRow` key also uses `previewId`, so duplicate keys can cause unstable React reconciliation.
- Evidence:
- `src/components/invoice/InvoiceUploadDialog.tsx:68`
- `src/components/invoice/InvoiceUploadDialog.tsx:70`
- `src/components/invoice/InvoiceUploadDialog.tsx:366`
- `src/components/invoice/InvoiceUploadDialog.tsx:442`
- `src/components/invoice/InvoiceUploadDialog.tsx:886`

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


## Technical Details

**Affected files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`

## Resources

- PR #110

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

## Notes

- This is a correctness/reliability issue and should be resolved before relying on row-level action persistence at scale.
