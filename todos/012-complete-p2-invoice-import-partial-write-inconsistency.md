---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, reliability, invoice-import]
dependencies: []
---

# Invoice import can report failure after successful product write

Create/update and stock movement are executed in the same try/catch without compensation. If stock movement fails, the product write already committed, but the row is reported as failed.

## Problem Statement

A row can be partially applied: product pricing updates persist, stock movement fails, and UI reports an error. Retrying import can then re-apply product updates and potentially over-count stock if the retry partially succeeds.

## Findings

- `src/pages/InventoryListPage.tsx:323` updates existing product before stock movement.
- `src/pages/InventoryListPage.tsx:336` creates new product before stock movement.
- `src/pages/InventoryListPage.tsx:332` / `src/pages/InventoryListPage.tsx:349` add stock movement after product write.
- Any stock movement exception is caught at row level and counted as a failed row (`src/pages/InventoryListPage.tsx:355`), even though earlier write already succeeded.

## Proposed Solutions

### Option 1: Treat stock-movement failure as partial success with explicit warning

Track separate statuses (`product_written`, `stock_failed`) and show explicit remediation action.

**Pros:**
- Honest UX about partial commit.
- Minimal implementation effort.

**Cons:**
- Does not make operation atomic.

**Effort:** Small

**Risk:** Low

---

### Option 2: Move row apply logic to backend transaction

Use backend `import` endpoint with idempotency and DB transaction semantics.

**Pros:**
- Strong consistency and safer retries.

**Cons:**
- Larger scope and backend dependency.

**Effort:** Medium/Large

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `src/pages/InventoryListPage.tsx:323`
- `src/pages/InventoryListPage.tsx:332`
- `src/pages/InventoryListPage.tsx:349`
- `src/pages/InventoryListPage.tsx:355`

## Resources

- Review branch: `codex/invoice-pricing-parity-weight-edit`

## Acceptance Criteria

- [ ] Import result distinguishes full success from partial success.
- [ ] Retry guidance prevents accidental double-application.
- [ ] Failure messaging includes whether product record was already written.

## Work Log

### 2026-02-11 - Code Review Discovery

**By:** Codex

**Actions:**
- Reviewed row execution order for invoice import.
- Validated failure handling around create/update + stock movement.

**Learnings:**
- Current control flow favors best-effort writes but surfaces binary row status.

## Notes

- This is important for operational trust and support debugging.

### 2026-02-11 - Fix Implemented

**By:** Codex

**Actions:**
- Split product write and stock movement failure handling for invoice rows.
- Added partial-result tracking when stock movement fails after successful product write.
- Updated user toast summary to include partially imported rows and keep warnings explicit.

**Learnings:**
- Best-effort writes need explicit partial-state UX to avoid misleading retry behavior.
