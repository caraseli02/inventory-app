---
title: "fix: Invoice import pricing conversion (MDL→EUR)"
type: fix
date: 2026-02-06
---

# fix: Invoice import pricing conversion (MDL→EUR)

## Overview
Fix invoice import so MDL costs are converted to EUR using BNM daily rates, store price is derived from the active markup tier (70%), and categories are auto-assigned when missing. Add per-item update/skip handling for existing product matches, while keeping the flow lightweight.

## Problem Statement / Motivation
Invoice OCR imports currently treat MDL unit costs as EUR, leading to inflated base prices and wrong store prices. Some items also arrive with missing categories. This breaks pricing trust and requires manual cleanup.

## Proposed Solution
- Fetch BNM official exchange rate for the invoice date (fallback to most recent previous available rate) and allow per-import override.
- Convert all `unitPrice` values from MDL → EUR; set `Price` to converted unit cost (EUR).
- Recompute totals as `quantity × converted unit price` to avoid mismatches.
- Compute only the active tier price (default 70%) and leave other tiers empty.
- Auto-assign category via AI/heuristics when missing; still editable in preview.
- Detect existing products by barcode; if missing barcode, attempt normalized name match; for matches, prompt per item to update or skip.
- Preserve existing invoice OCR validations (avoid NaN/invalid numbers).

## Technical Considerations
- **BNM source**: Official exchange rate pages expose “Rate XML / Export CSV / Export XLS” and an interactive database; identify the actual export endpoints and verify CORS/availability. citeturn5search0turn5search2
- **BNM digital service**: There is an official digital service for exchange rate information; evaluate if it provides a more stable API. citeturn0search2
- **Date selection**: Use invoice date when available; fallback to previous rate for weekends/holidays.
- **Rounding**: Store EUR prices at 2 decimals (current schema), and use that for tier calc and display.
- **Normalization**: Define name match rules (case, punctuation, diacritics); avoid fuzzy matching unless specified.
- **Validation**: Keep number validation in `InvoiceUploadDialog` to prevent NaN and runtime issues (per existing solution docs).

## SpecFlow Findings (Summary)

### User Flow Overview
1. Upload PDF → OCR extraction → preview list.
2. FX rate fetch (invoice date) → conversion applied → preview shows EUR cost + store price.
3. User edits items (qty/price/category) and resolves matches (update/skip).
4. Confirm import → create/update products + stock movements.

### Flow Permutations Matrix (Key)
- With/without invoice date.
- Rate available vs missing (fallback).
- Online vs offline/BNM unreachable.
- Barcode present vs absent; name match found vs not found.
- User overrides FX rate vs uses auto rate.

### Missing Elements & Gaps
- CORS behavior and availability of BNM export endpoints.
- UI placement for per-item update/skip (lightweight vs clutter).
- Exact normalization rules for name matching.
- Behavior when FX rate fetch fails and user does not override.

### Critical Questions
- What exact export URL and format (XML/CSV/XLS) should be used from BNM?
- Should FX override be persisted for the session only or across imports?

### Recommended Next Steps
- Validate BNM export endpoints and CORS in-browser.
- Decide normalization rules and preview UI placement for update/skip.

## Acceptance Criteria
- [x] Invoice import converts MDL unit costs to EUR using BNM rate for invoice date (fallback to previous date).
- [x] User can override FX rate per import; override is used in calculations.
- [x] `Price` stores EUR unit cost; totals recomputed as `qty × price`.
- [x] Only active tier (70%) price is set; other tier prices remain empty.
- [x] Missing categories are auto-assigned; user can edit in preview.
- [x] Existing product matches trigger per-item update/skip choice.
- [x] No NaN/invalid numeric values reach the UI or database.

## Success Metrics
- Store price matches expected 70% markup for imported items (±€0.01).
- Zero “€NaN” or invalid price displays during preview/import.
- Manual QA on at least 2 invoices shows correct EUR conversion and categories.

## Dependencies & Risks
- **BNM endpoint stability/CORS** may block client-side requests; may require a proxy.
- **Rate availability** on weekends/holidays requires fallback logic.
- **Name matching** could create false positives if normalization too aggressive.

## References & Research
- Brainstorm: `docs/brainstorms/2026-02-06-invoice-import-pricing-mdl-eur-brainstorm.md`
- Invoice OCR flow: `src/lib/invoiceOCR.ts`
- Invoice import UI: `src/components/invoice/InvoiceUploadDialog.tsx`
- Import pipeline: `src/pages/InventoryListPage.tsx`
- Pricing display: `src/components/product/EditProductDialog.tsx`
- Price tier spec: `docs/specs/xlsx_integration.md`
- BNM exchange rate pages (Rate XML/CSV/XLS export available): citeturn5search0turn5search2
- BNM digital exchange-rate service announcement: citeturn0search2
- Relevant learnings:
  - `docs/solutions/ui-bugs/invoice-ocr-nan-input-validation-in-number-fields.md`
  - `docs/solutions/runtime-errors/invoice-ocr-runtime-product-field-validation.md`
  - `docs/solutions/runtime-errors/invoice-ocr-total-amount-type-validation.md`
  - `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`
  - `docs/solutions/performance-issues/invoice-ocr-fake-progress-reporting.md`
