---
title: Excel Import Invoice-Style Matching Parity
module: xlsx
date: 2026-03-31
problem_type: logic_error
component: tooling
severity: medium
tags: [excel-import, invoice-import, parity, matching, preview-resolution]
symptoms:
  - "Excel import blocked rows without barcodes with error: 'Barcode is required for canonical Excel import'"
  - "Users unable to import valid Excel files where barcode column was empty or missing"
  - "Import preview showed blocking errors for new products without barcodes"
root_cause: logic_error
resolution_type: code_fix
applies_when:
  - "Adding new preview-based import workflows that require matching logic"
  - "Ensuring parity between different import sources (Excel vs invoice)"
  - "Implementing skip resolution for already-imported items without matches"
---

# Excel Import Invoice-Style Matching Parity

## Context

Excel import was falling back to create-only behavior, lacking invoice-style matching, diff detection, and proper action resolution. This caused friction when re-importing files:

- Users couldn't see what would change (skips vs updates vs creates)
- System couldn't distinguish between new products and updates to existing ones
- Every re-import attempt would create duplicate products instead of updating existing ones

The gap was identified in `src/components/xlsx/ImportDialog.tsx` which sent raw parsed rows directly to `runXlsxImport()`, while invoice import computes match results, diffs, and default actions per row via `useInvoiceComputed.ts`.

## Guidance

Use shared diff detection and action resolution logic from invoice import. Key pattern: **barcode-only matching with `isAlreadyImported` flag checks before attempting product lookup.**

### Critical Implementation Pattern

In `src/lib/xlsx/preview.ts`, the critical fix is line 26:

```typescript
function getDefaultExcelImportAction(input: {
  hasMatch: boolean;
  isAlreadyImported: boolean;
  hasDiffs: boolean;
}): XlsxImportAction {
  if (input.isAlreadyImported && !input.hasMatch) {
    return 'skip';  // ← Critical: prevents wasteful lookups for already-imported rows
  }
  if (!input.hasMatch) return 'create';
  if (input.isAlreadyImported) return input.hasDiffs ? 'update' : 'skip';
  return input.hasDiffs ? 'update' : 'receive_stock';
}
```

This single line prevents attempting product lookups for already-imported rows that lack barcodes, avoiding wasteful API calls and correctly resolving the action to "skip."

**Important: Barcodes are optional in Excel files**
- Real-world Excel files often don't have barcodes populated
- The import gracefully handles both cases:
  - **With barcode**: Matches existing product by barcode
  - **Without barcode**: Creates new product (barcode can be added later via Edit)
- No blocking error for missing barcodes (unlike the original implementation)

### Leverage Shared Functions

- **`buildInvoiceProductUpdatePayload()`** - Constructs proper update payloads with field diffs (Price, Supplier, Category, excluding "General")
- **`getDefaultExcelImportAction()`** - Mirrors `getDefaultInvoiceImportAction()` for consistent action resolution
- **Barcode-first matching** - Excel import uses barcode-only (no name fallback), which is intentional per requirements

### Architecture Pattern

```
ImportDialog → buildXlsxPreviewRows() → preview state → user confirmation → runXlsxImport()
```

Key functions:
- `buildXlsxPreviewRows()` - Computes match status, diffs, and default actions
- `getBlockingError()` - Validates row state (barcode required, quantity present for stock actions)
- `applyExcelImportAction()` - Handles user action overrides

## Why This Matters

- **Prevents duplicate products** on re-import - same file can be imported multiple times safely
- **Ensures idempotency** - batch-based tracking via `excelBatchId` and `excelRowId` prevents duplicate stock receipts
- **Matches user expectations** - bulk operations show clear preview of what will change
- **Reduces API load** - skip actions don't trigger product lookups or stock movements

Without this parity, Excel import would create duplicates on every run and waste API cycles on unnecessary lookups.

## When to Apply

Apply this pattern when:
- Implementing any import feature that needs match resolution and action handling
- Building preview interfaces that show pending changes before confirmation
- Adding bulk operations where users may re-import files
- Ensuring parity between different import sources (e.g., Excel vs invoice, CSV vs API)

## Examples

### Before (Broken)

```typescript
// Always creates new products, no matching
const importedProducts = parseXlsx(file);
await runXlsxImport(importedProducts, []);
// Result: Duplicates on every re-import
```

### After (Fixed)

```typescript
// Resolves action based on match + diff detection
const previewRows = buildXlsxPreviewRows(importedProducts, allProducts, alreadyImportedRowIds);
// User reviews and confirms actions
await runXlsxImport(importedProducts, allProducts);
// Result: Skips already-imported, updates diffs, creates new products
```

### Test Coverage

The implementation added 42 tests across `xlsxPreview.test.ts` and `xlsxImportRunner.test.ts` covering:

- ✅ Match with no diffs → `receive_stock` action
- ✅ Match with diffs → `update` action  
- ✅ Already imported, unchanged → `skip` action
- ✅ Already imported, unmatched → `skip` action (critical parity fix)
- ✅ Edge cases: empty/undefined barcodes, deleted products, whitespace trimming
- ✅ Error paths: create/update failures, stock movement failures, quantity validation

All requirements R1-R7 from the plan verified as implemented.

## Related Documentation

- `docs/solutions/state-issues/false-complete-after-partial-or-fatal-import-ProductImportUI-20260329.md` - Shared import UI contract weakness affecting both Excel and invoice dialogs
- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md` - Invoice import had similar deduplication issues that Excel import avoids
- `docs/solutions/logic-errors/invoice-import-name-dedup-override-InvoiceImport-20260225.md` - Excel's barcode-only approach avoids invoice's name-based dedup complexity
- `docs/specs/xlsx_integration.md` - Excel integration spec defining canonical delivery import contract

## Implementation Details

**Files Modified/Created:**
- `src/lib/xlsx/preview.ts` (NEW) - Complete parity implementation
- `src/lib/__tests__/xlsxPreview.test.ts` (MODIFIED) - Added 13 test scenarios
- `src/lib/__tests__/xlsxImportRunner.test.ts` (CREATED) - 25 comprehensive tests
- `src/components/xlsx/ImportDialog.tsx` (VERIFIED) - Uses `buildXlsxPreviewRows()` correctly

**Key Decisions:**
- Barcode-only matching (intentional per requirements - no name fallback)
- Separate but identical action resolution function for clarity
- Batch-based idempotency using file hash + row identifiers
- Shared diff detection via `buildInvoiceProductUpdatePayload()`
