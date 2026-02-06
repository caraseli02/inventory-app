---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, invoice-ocr, ui, pricing]
dependencies: []
---

# Removed invoice rows reappear after FX rate change

## Problem Statement

When a user removes a product row in the invoice preview and then adjusts the FX rate, the removed items are reintroduced because the conversion effect rebuilds the list from the original OCR array.

## Findings

- `rawProducts` remains the full OCR list even after user removals.
- The FX conversion effect maps `rawProducts` into `editableProducts` whenever `fxRate` changes.
- This rebuild ignores deletions and re-adds removed items.

## Proposed Solutions

### Option 1: Track removals and filter before rebuild

**Approach:** Maintain a set of removed row IDs and filter `rawProducts` before rebuilding.

**Pros:** Minimal changes, keeps conversion logic intact.

**Cons:** Requires stable IDs for rows.

**Effort:** Small

**Risk:** Low

---

### Option 2: Store converted base values separately

**Approach:** Keep a normalized list of editable items and update prices in place instead of replacing the entire array.

**Pros:** Preserves edits/removals naturally.

**Cons:** More refactor, needs careful merge logic.

**Effort:** Medium

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`

## Resources

- PR #97

## Acceptance Criteria

- [ ] Removing a row persists even after FX rate change or override
- [ ] Manual QA: remove a row, update FX, verify removed row stays gone

## Work Log

### 2026-02-06 - Review finding

**By:** Codex

**Actions:**
- Identified conversion effect rebuild from rawProducts

**Learnings:**
- Full list replacement breaks user deletions

