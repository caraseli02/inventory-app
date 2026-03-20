---
status: pending
priority: p2
issue_id: "030"
tags: [code-review, reliability, invoice-ocr, idempotency, pricing]
dependencies: ["027"]
---

# Duplicate OCR rowId can still collide pricing + idempotency

## Problem Statement

We fixed **UI preview identity** collisions (todo 027) by making `previewId` unique per row. But the pipeline still treats `rowId` as a unique identifier in multiple places. If OCR outputs duplicate `rowId` values, pricing previews, “already imported” checks, and idempotency can still collide and misapply data across rows.

## Findings

- Pricing preview request uses `row_id: p.rowId || row-${i + 1}`:
  - `src/hooks/useInvoiceImport.ts:130` (inside `usePricingPreviewEffect` request mapping)
- Pricing results are stored as `PricingByRowId` keyed by `row_id`:
  - `src/hooks/useInvoiceImport.ts:133`
  - `src/hooks/useInvoiceComputed.ts:48` (`pricingById[rowId]`)
- Row flags + already-imported checks also key off `rowId`:
  - `src/hooks/useInvoiceComputed.ts:47` (`const rowId = p.rowId || row-${i + 1}`)
  - `src/hooks/useInvoiceComputed.ts:49` (`importedIds.has(rowId)`)
- If OCR duplicates `rowId`, multiple rows can:
  - share pricing computation (wrong prices displayed/used)
  - share “already imported” state (wrongly marked imported / skipped)
  - share any downstream idempotency keyed by rowId (risk: missing/duplicated imports)

## Proposed Solutions

### Option 1: Use a unique `rowKey` everywhere client-side

**Approach:** Treat `previewId` (or a dedicated UUID) as the unique row key. Send it as `row_id` to pricing preview, and keep the original OCR `rowId` as a separate field for display/debug only.

**Pros:**
- Fully collision-safe without relying on OCR rowId quality
- Aligns UI identity with backend preview identity

**Cons:**
- Requires backend/API tolerance for arbitrary `row_id` strings
- Requires updating any server-side idempotency assumptions (if any)

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Deduplicate OCR `rowId` at ingest

**Approach:** On invoice parse, normalize row IDs to be unique (e.g., `row-dup#1`, `row-dup#2`) while preserving the original raw ID separately.

**Pros:**
- Minimal downstream changes
- Keeps current “rowId is identity” concept working

**Cons:**
- Adds mapping complexity + risk of subtle drift
- Still couples correctness to ingest logic

**Effort:** Small-Medium

**Risk:** Low-Medium

---

### Option 3: Generate UUID per row at ingest (stable)

**Approach:** Generate a UUID for each OCR row once and carry it through: UI keys, action maps, pricing preview row_id, and import pipeline.

**Pros:**
- Fully stable even if rows reorder
- No reliance on external IDs

**Cons:**
- More wiring (types + transformations)

**Effort:** Medium

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/hooks/useInvoiceImport.ts` (pricing preview request + result mapping)
- `src/hooks/useInvoiceComputed.ts` (rowId-derived flags/pricing lookup)
- `src/lib/invoiceIdempotency.ts` (if any logic assumes rowId uniqueness)

## Resources

- Related: `todos/027-pending-p2-preview-id-collision-on-duplicate-rowid.md`

## Acceptance Criteria

- [ ] Duplicate OCR `rowId` values do not cause shared pricing computation across rows
- [ ] Duplicate OCR `rowId` values do not cause shared “already imported” flags across rows
- [ ] Import pipeline preserves per-row correctness with duplicate `rowId`
- [ ] Unit test covers duplicate-rowId pricing mapping (two rows, distinct computed results)

## Work Log

### 2026-03-20 - Review finding

**By:** Codex

**Actions:**
- Flagged remaining collision risk beyond UI `previewId` keys (pricing/idempotency still keyed by `rowId`).

**Learnings:**
- Fixing React keys/state maps is necessary but not sufficient if backend-facing row identifiers can collide.
