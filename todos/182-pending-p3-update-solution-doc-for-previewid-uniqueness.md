---
status: pending
priority: p3
issue_id: "182"
tags: [code-review, docs, solutions, invoice-import]
dependencies: ["027"]
---

# Update solution doc: previewId must be unique under duplicate OCR rowId

## Problem Statement

The solution doc that introduced `previewId` identity for invoice preview rows includes a `getPreviewId` snippet that returns `row:${rowId}` when `rowId` exists. We now require an index tiebreaker (`row:${rowId}:idx:${index}`) to avoid collisions when OCR emits duplicate `rowId` values.

If the doc stays stale, future refactors may regress the fix by following outdated guidance.

## Findings

- Doc currently shows `getPreviewId` returning `row:${rowId}`:
  - `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md:42`
- Current code requires uniqueness guard:
  - `src/hooks/useInvoiceImport.helpers.ts:51`

## Proposed Solutions

### Option 1: Update the doc snippet + narrative (recommended)

**Approach:** Change the snippet in the solution doc to `row:${rowId}:idx:${index}` and add a short note about duplicate OCR rowId.

**Pros:**
- Keeps institutional knowledge accurate
- Low effort, prevents regressions

**Cons:**
- None meaningful

**Effort:** Small

**Risk:** Low

---

### Option 2: Add an addendum section referencing todo 027

**Approach:** Leave original snippet as “historical” and add an addendum describing the follow-up fix.

**Pros:**
- Preserves historical context

**Cons:**
- More verbose, easier to miss

**Effort:** Small

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `docs/solutions/state-issues/invoice-preview-row-state-drift-InvoiceUploadDialog-20260216.md`

## Resources

- Related: `todos/027-pending-p2-preview-id-collision-on-duplicate-rowid.md`

## Acceptance Criteria

- [ ] Doc snippet matches current `getPreviewId` behavior
- [ ] Doc mentions duplicate OCR `rowId` collision risk

## Work Log

### 2026-03-20 - Review finding

**By:** Codex

**Actions:**
- Identified doc drift after strengthening previewId uniqueness.

