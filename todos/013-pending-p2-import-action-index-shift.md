---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, invoice-ocr, ui, state]
dependencies: []
---

# Import action selections shift after row removal

## Problem Statement

Invoice import preview stores per-row update/skip choices by array index. Removing a row shifts indices, which can apply the wrong action to a different product.

## Findings

- In `InvoiceUploadDialog.tsx`, `importActions` is keyed by index and rebuilt from previous state by index.
- When a row is removed, indices shift but previous selections are reused by numeric index, misaligning user choices.
- Example: row 0 set to Skip, remove row 0 → previous row 1 becomes index 0 and inherits Skip.

## Proposed Solutions

### Option 1: Key actions by stable ID

**Approach:** Add a stable `id` to each preview product (e.g., hash of name+barcode+position or generated UUID) and store actions by id.

**Pros:** Stable across deletions/insertions; correct mapping.

**Cons:** Requires adding/propagating IDs in preview model.

**Effort:** Small

**Risk:** Low

---

### Option 2: Rebuild actions on remove

**Approach:** When removing a row, rebuild `importActions` to match remaining items by original identity (barcode/name).

**Pros:** Minimal data model changes.

**Cons:** Matching heuristics can still mis-map duplicates.

**Effort:** Small

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`

## Resources

- PR #97

## Acceptance Criteria

- [ ] Removing a row does not change other rows' update/skip selection
- [ ] Actions are stable when rows are added/removed
- [ ] Manual QA: set actions on multiple rows, remove one, verify others unchanged

## Work Log

### 2026-02-06 - Review finding

**By:** Codex

**Actions:**
- Identified index-based action mapping and shift risk

**Learnings:**
- Index-based state is fragile when list is mutable

