---
status: complete
priority: p1
issue_id: "059"
tags: [code-review, invoice-import, pricing, idempotency, regression]
dependencies: []
---

# Fix Invoice Preview Price Drift Causing False Update Defaults

Replace preview diff computation input with stable original LEI totals (or cached preview output) so re-uploading the same invoice with unchanged FX does not default already-imported rows to `Update`.

## Problem Statement

The invoice preview preloads pricing by reconstructing `line_total_lei` from rounded EUR totals (`product.totalPrice * fxRate`). This can introduce drift from the original extracted LEI values and makes already-imported rows appear price-different even when the user did not change FX. Result: re-uploaded invoice rows default to `Update` instead of `Skip`.

## Findings

- `loadPricingPreview()` sends `line_total_lei: roundCurrency(product.totalPrice * fxRate!)` using `editableProducts` state, not the original extracted LEI line totals in `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:452`.
- `editableProducts.totalPrice` is previously derived from `rawProducts.totalPrice / fxRate` and rounded to 2 decimals, so the round-trip is lossy (`LEI -> EUR rounded -> LEI`) in `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:289`.
- `rowFlags` then derives `hasPriceDiffs` from this recomputed preview and can mark all already-imported rows as changed in `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx:494`.
- Increasing tolerance reduced symptoms but does not fix the root cause; user manually reproduced continued false `Update` preselection.

## Proposed Solutions

### Option 1: Preserve Original LEI Line Totals (Recommended)

**Approach:** Store each row’s original extracted LEI total in preview state and use that for all preview-pricing requests, independent of displayed EUR edits.

**Pros:**
- Deterministic re-upload behavior
- Aligns preview and import calculations
- Minimal backend changes

**Cons:**
- Requires adding another stable field to `InvoicePreviewProduct`
- Need clear behavior if user manually edits EUR total/qty

**Effort:** 2-4 hours

**Risk:** Low

---

### Option 2: Cache Initial Preview Computed Values Per Row for Defaulting

**Approach:** Use server preview only at import time; use cached first-pass computed prices (or existing import values) for default-action diffing.

**Pros:**
- Avoids repeated conversion drift in defaulting
- Reduces API calls

**Cons:**
- More state complexity
- Must invalidate cache on relevant edits (qty/weight/FX)

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 3: Compare Rounded Persisted Prices Only

**Approach:** Round computed prices to the exact persistence/display precision before diffing.

**Pros:**
- Fast patch
- Small code change

**Cons:**
- Still masks root drift
- May hide real small price updates if business logic needs more precision

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx`
- `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceImportDiffs.ts`

**Related components:**
- Invoice preview default action selection
- Preview pricing API (`/invoice/preview-pricing`)

**Database changes (if any):**
- No

## Resources

- **Branch:** `codex/feat-invoice-import-idempotent-actions`
- **User repro:** same invoice + unchanged FX still defaults rows to `Update`

## Acceptance Criteria

- [ ] Re-uploading same invoice with unchanged FX defaults already-imported rows to `Skip` (unless real persisted price diff exists)
- [ ] Changing FX can still flip already-imported rows with real price diffs to `Update`
- [ ] Behavior is stable across repeated re-open/re-render cycles
- [ ] Unit test covers round-trip conversion drift scenario

## Work Log

### 2026-02-25 - Code Review Discovery

**By:** Codex

**Actions:**
- Reviewed invoice preview diff/defaulting flow
- Traced price diff inputs from FX recalculation to preview pricing preload
- Identified lossy LEI↔EUR round-trip as source of false price diffs

**Learnings:**
- Tolerance-only fixes reduce noise but do not guarantee correct `Skip` defaults

## Notes

- This is user-visible regression affecting core idempotency UX.
