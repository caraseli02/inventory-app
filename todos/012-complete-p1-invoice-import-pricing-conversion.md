---
status: complete
priority: p1
issue_id: "012"
tags: [invoice-ocr, pricing, import]
dependencies: []
---

# Fix invoice import pricing conversion

## Problem Statement

Invoice OCR import treats MDL as EUR, wrong pricing. Missing categories. No per-item update/skip for matches.

## Findings

- Invoice import uses raw OCR prices in EUR with no FX conversion.
- Categories set to undefined in import mapping.
- Import skips existing barcode matches without user choice.

## Proposed Solutions

### Option 1: BNM XML rate + lightweight UI controls

**Approach:** Fetch BNM EUR rate (with fallback), allow per-import override, convert prices, add match update/skip control.

**Pros:** Low risk, minimal UI change, aligns plan.

**Cons:** CORS risk, best-effort fallback.

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Implement Option 1. Add FX fetch helper in lib, update InvoiceUploadDialog UI + import mapping, extend import pipeline to support update/skip.

## Technical Details

**Affected files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/pages/InventoryListPage.tsx`
- `src/lib/xlsx/index.ts`
- `src/lib/exchangeRates.ts` (new)

## Resources

- `docs/plans/2026-02-06-fix-invoice-import-pricing-conversion-plan.md`

## Acceptance Criteria

- [x] MDL -> EUR conversion via BNM rate with fallback
- [x] FX override per import
- [x] Totals recomputed from converted unit price
- [x] Only 70% tier computed
- [x] Missing categories auto-assigned, editable
- [x] Per-item update/skip for matches
- [x] No NaN in UI/import

## Work Log

### 2026-02-06 - Start

**By:** Codex

**Actions:**
- Read plan and references
- Scanned invoice import flow

**Learnings:**
- Invoice upload uses direct OCR unit prices
- Import pipeline only supports create+skip

### 2026-02-06 - Implementation

**By:** Codex

**Actions:**
- Added BNM FX fetch helper with fallback
- Converted invoice prices MDL -> EUR + recompute totals
- Added FX override UI, category auto-assign, match update/skip
- Extended import pipeline to update existing products
- Lint: `pnpm lint`

**Learnings:**
- BNM XML endpoint may fail; manual override needed

## Notes

- Watch CORS for BNM endpoint
