---
module: Invoice Import
date: 2026-02-12
problem_type: logic_error
component: utility
symptoms:
  - "Invoice import created duplicate products instead of updating matched ones"
  - "Category suggestions showed in preview but existing products stayed as General after import"
  - "Weight (kg) became Missing after FX rate recalculation"
  - "Importing loader stayed at 0 of N until completion"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [invoice-import, category-suggestion, deduplication, progress, barcode-normalization, weightkg, react]
---

# Troubleshooting: Invoice Import Duplicates and Missed Field Updates

## Problem

Invoice import started using backend-provided category suggestions successfully in the preview UI, but importing could still create duplicates (instead of updating matched products), fail to persist category updates, and show broken weight/progress behavior during the import flow.

## Environment

- Module: Invoice Import
- App: Vite + React + TypeScript
- Date: 2026-02-12

## Symptoms

- Duplicate products created even when the invoice preview showed a barcode/name match.
- Existing products that previously had no category remained `General` after import, even when preview category was set.
- `Weight (kg)` appeared initially, then flipped to `Missing` once FX rate recalculation ran.
- Import loader showed `0 of N` until the end, then jumped to success toast.

## What Didn't Work

**Direct solution:** The problems were identified and fixed by reviewing the mapping and import code paths end-to-end (preview state mapping, import payload conversion, and import handler update/create logic).

## Solution

### 1) Preserve `weightKg` during FX-rate remap (avoid resetting to `undefined`)

**File:** `src/components/invoice/InvoiceUploadDialog.tsx`

- The FX-rate `useEffect` rebuilt `editableProducts` but omitted `weightKg`, causing it to reset.
- Fix: carry forward `previous.weightKg` or fall back to `weightKgCandidate` / name parsing.

### 2) Ensure invoice “update” actually updates Category (and doesn’t create duplicates)

**File:** `src/pages/InventoryListPage.tsx`

- Invoice import path previously updated prices and stock but did not update `Category`.
- Worse: matching logic depended on the filtered `products` list, so with filters active (or when `existingProductId` wasn’t in the filtered list), matched rows could fall through to “create new product”.

Fixes:
- Build indices for matching from `allProducts` (full inventory), not the filtered `products`.
- Treat `existingProductId` as authoritative when `importAction=update` and update by ID directly (never depend on filtered list membership).
- Only write `Category` when the incoming value is non-default (`!= "General"`), to avoid overwriting curated categories.

### 3) Normalize barcodes consistently for matching and creation

**Files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/pages/InventoryListPage.tsx`

Fixes:
- Trim barcode when converting invoice preview rows into `ImportedProduct`.
- Use a single `normalizeBarcode()` (trim, empty -> undefined) before `getProductByBarcode()` and before create payloads.
- Apply the same normalization to XLSX import path as well.

### 4) Show live import progress in the loader

**Files:**
- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/pages/InventoryListPage.tsx`

Fixes:
- Extend `onImport` to accept an optional progress callback.
- Call `onProgress(processed, total)` after each row finishes (including update/create/skip/error).
- Update translations to say “processed” rather than “created”.

**Files updated for i18n copy:**
- `src/locales/en.json`
- `src/locales/ro.json`
- `src/locales/ru.json`
- `src/locales/es.json`

## Why This Works

1. **Weight reset** happened because a state remap omitted `weightKg`, so React state lost the value on recalculation.
2. **Duplicate creation** happened because invoice-import matching used the filtered product list, and because “update intent” wasn’t treated as authoritative by ID.
3. **Category not updated** happened because the invoice update payload didn’t include `Category` at all.
4. **Progress stuck at 0** happened because the progress UI had no feedback channel from the actual import loop that performs work.

## Prevention

- Add unit tests for the invoice import mapping:
  - FX-rate recalculation must preserve `weightKg`.
  - When `importAction=update` and `existingProductId` is present, import handler must update by ID (even with inventory filters active).
- Add a small helper module for normalization (`normalizeBarcode`, `normalizeName`) and test it independently.
- Consider surfacing a breakdown in import progress (`updated/created/skipped/failed`) so “processed” is more informative.

## Related Issues

- See also: `docs/solutions/logic-errors/mdl-prices-treated-as-eur-InvoiceUploadDialog-20260206.md`
- See also: `docs/solutions/performance-issues/invoice-ocr-fake-progress-reporting.md`
- See also: `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`

