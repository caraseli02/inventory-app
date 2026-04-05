---
title: Excel Import Invoice-Style Matching Parity
module: xlsx
date: 2026-03-31
last_updated: 2026-04-01
problem_type: logic_error
component: tooling
severity: medium
tags: [excel-import, invoice-import, parity, matching, preview-resolution, idempotency, barcode-less, name-fallback]
symptoms:
  - "Excel import blocked rows without barcodes with error: 'Barcode is required for canonical Excel import'"
  - "Barcode-less products created duplicates because no name-fallback matching existed"
  - "Idempotency notes silently skipped for products without barcodes"
  - "Race condition: concurrent imports could process same row twice (idempotency check after DB writes)"
  - "Name-only products (no barcode) never matched existing inventory, always created duplicates"
root_cause: logic_error
resolution_type: code_fix
applies_when:
  - "Adding new preview-based import workflows that require matching logic"
  - "Ensuring parity between different import sources (Excel vs invoice)"
  - "Implementing skip resolution for already-imported items without matches"
  - "Handling imports where source data may lack barcodes (common in real-world xlsx files)"
  - "Building idempotency guards for concurrent import scenarios"
---

# Excel Import Invoice-Style Matching Parity

## Context

Excel import was falling back to create-only behavior, lacking invoice-style matching, diff detection, and proper action resolution. This caused friction when re-importing files:

- Users couldn't see what would change (skips vs updates vs creates)
- System couldn't distinguish between new products and updates to existing ones
- Every re-import attempt would create duplicate products instead of updating existing ones

The gap was identified in `src/components/xlsx/ImportDialog.tsx` which sent raw parsed rows directly to `runXlsxImport()`, while invoice import computes match results, diffs, and default actions per row via `useInvoiceComputed.ts`.

## Problem

Excel import had three critical gaps:

1. **Barcode required**: `REQUIRED_FIELDS` included `Barcode`, blocking imports of real-world Excel files where barcode columns are empty or missing
2. **No name-fallback matching**: Products without barcodes could never match existing inventory — always created duplicates
3. **Race condition in idempotency**: The `alreadyImportedRowIds` check happened after DB writes began, allowing concurrent imports to process the same row twice
4. **Broken idempotency notes**: `buildExcelStockNote()` skipped note generation for products without barcodes, silently losing idempotency tracking

## Symptoms

- Import preview showed blocking error: "Barcode is required for canonical Excel import"
- Products with empty barcode column created duplicates on every import
- Stock movements for barcode-less products had no idempotency note — re-imports couldn't detect them
- Concurrent imports of the same file could duplicate stock receipts

## What Didn't Work

1. **Keeping Barcode in REQUIRED_FIELDS**: Real-world Excel files from customers routinely lack barcodes. The requirement was wrong — barcodes should be optional, addable later via edit dialog.
2. **Barcode-only matching without fallback**: When barcode was empty, no matching occurred at all. This meant products like "Milk" with no barcode would always create a new "Milk" instead of matching the existing one.
3. **Idempotency check after DB writes**: The original flow was: resolve product → update/create → add stock movement → then mark row as imported. If two imports ran concurrently, both would pass the idempotency check before either marked the row.

## Solution

### Fix 1: Remove Barcode from REQUIRED_FIELDS

In `src/lib/xlsx/columnMapping.ts`:

```typescript
// Before (broken):
export const REQUIRED_FIELDS = ['Name', 'Barcode'] as const;

// After (fixed):
export const REQUIRED_FIELDS = ['Name'] as const;
```

Only `Name` is required. Barcode is optional — can be added later via the edit dialog's barcode scanner.

### Fix 2: Name-Fallback Matching in Preview

In `src/lib/xlsx/preview.ts`, added a `productByName` index alongside `productByBarcode`:

```typescript
const productByBarcode = new Map<string, Product>();
const productByName = new Map<string, Product>();
allProducts.forEach((product) => {
  const barcode = normalizeBarcode(product.fields.Barcode);
  if (barcode) productByBarcode.set(barcode, product);
  const nameKey = product.fields.Name?.trim().toLowerCase();
  if (nameKey) productByName.set(nameKey, product);
});

// In buildXlsxPreviewRows:
let matchedProduct = barcode ? productByBarcode.get(barcode) ?? null : null;
if (!matchedProduct) {
  const nameKey = product.Name?.trim().toLowerCase();
  if (nameKey) matchedProduct = productByName.get(nameKey) ?? null;
}
```

Matching priority: barcode-first, then name-fallback. This prevents duplicate creation of barcode-less products that share a name with existing inventory.

### Fix 3: Early Idempotency Mark (Race Condition Fix)

In `src/lib/xlsxImportRunner.ts`, moved the idempotency mark before DB writes:

```typescript
const rowId = imported.excelRowId?.trim();
const isAlreadyImportedRow = Boolean(rowId && state.alreadyImportedRowIds.has(rowId));
// Mark row as in-progress immediately to prevent concurrent duplicate processing
if (rowId && !isAlreadyImportedRow) state.alreadyImportedRowIds.add(rowId);
const existing = await resolveExistingProduct(imported, state);
```

This ensures the second concurrent import sees the row as already imported before any DB writes begin.

### Fix 4: Name-Based Note Fallback

In `src/lib/xlsxImportRunner.ts`, updated `buildExcelStockNote()` to use product name when barcode is absent:

```typescript
function buildExcelStockNote(imported: ImportedProduct): string | undefined {
  const rowId = imported.excelRowId?.trim();
  const batchId = imported.excelBatchId?.trim();
  const barcode = imported.Barcode?.trim();
  const name = imported.Name?.trim();

  if (!rowId || !batchId) return undefined;
  // Barcode is optional; use Name as fallback identity for idempotency tracking
  return buildExcelRowNote({ batchId, rowId, barcode: barcode || name || '' }) ?? undefined;
}
```

## Why This Works

- **Barcode is optional**: Real-world Excel files often don't have barcodes populated. The import gracefully handles both cases — with barcode: matches existing product; without barcode: falls back to name matching, then creates if no match.
- **Name-fallback prevents duplicates**: When barcode is empty but name matches an existing product, the preview correctly shows `receive_stock` instead of `create`, preventing duplicate product creation.
- **Early idempotency mark**: By adding the row ID to `alreadyImportedRowIds` before any async DB operations, concurrent imports see the row as already processed — no race window.
- **Name-based note tracking**: Even without a barcode, the stock movement note includes the product name, allowing the idempotency pre-check to find and skip already-imported rows on re-import.

## Prevention

1. **REQUIRED_FIELDS should reflect real-world usage**: Only fields that are truly mandatory for import should be in `REQUIRED_FIELDS`. Barcode is a "nice to have" — don't block imports for missing optional data.
2. **Always provide a matching fallback**: When the primary matching key (barcode) may be absent, provide a secondary key (name) to prevent duplicate creation.
3. **Mark state before async operations**: When using in-memory sets for idempotency checks, add the entry before the first async operation — not after. The pattern is: check → mark → do work.
4. **Test with real files**: The fixes were verified with `public/Prețuri magazin.xlsx` — 12 products parsed correctly, including products without barcodes.

## When to Apply

Apply this pattern when:
- Implementing any import feature that needs match resolution and action handling
- Building preview interfaces that show pending changes before confirmation
- Adding bulk operations where users may re-import files
- Ensuring parity between different import sources (e.g., Excel vs invoice, CSV vs API)
- Handling idempotency for concurrent bulk operations

## Examples

### Before (Broken)

```typescript
// Always creates new products, no matching
const importedProducts = parseXlsx(file);
await runXlsxImport(importedProducts, []);
// Result: Duplicates on every re-import, blocks on missing barcodes
```

### After (Fixed)

```typescript
// Resolves action based on match + diff detection with name fallback
const previewRows = buildXlsxPreviewRows(importedProducts, allProducts, alreadyImportedRowIds);
// User reviews and confirms actions
await runXlsxImport(importedProducts, allProducts);
// Result: Skips already-imported, updates diffs, creates only truly new products
```

### Test Coverage

The implementation has comprehensive tests across `xlsxPreview.test.ts`, `xlsxImportRunner.test.ts`, and `xlsxParser.test.ts`:

- ✅ Match with no diffs → `receive_stock` action
- ✅ Match with diffs → `update` action
- ✅ Already imported, unchanged → `skip` action
- ✅ Already imported, unmatched → `skip` action (critical parity fix)
- ✅ No barcode, name matches existing → `receive_stock` (name-fallback)
- ✅ No barcode, no name match → `create` (new product)
- ✅ Empty barcode treated as missing, falls back to name matching
- ✅ Edge cases: undefined barcodes, deleted products, whitespace trimming
- ✅ Error paths: create/update failures, stock movement failures, quantity validation
- ✅ Idempotency: first import allowed, re-import skipped, update on diff allowed
- ✅ Parser: accepts files without barcode column, rejects missing Name column

All 436 tests passing. Verified with real Excel file (`public/Prețuri magazin.xlsx`).

## Related Documentation

- `docs/solutions/state-issues/false-complete-after-partial-or-fatal-import-ProductImportUI-20260329.md` - Shared import UI contract weakness affecting both Excel and invoice dialogs
- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md` - Invoice import had similar deduplication issues that Excel import avoids
- `docs/solutions/logic-errors/invoice-import-name-dedup-override-InvoiceImport-20260225.md` - Excel's barcode-only approach avoids invoice's name-based dedup complexity
- `docs/specs/xlsx_integration.md` - Excel integration spec defining canonical delivery import contract

## Implementation Details

**Files Modified/Created:**
- `src/lib/xlsx/preview.ts` — Name-fallback matching via `productByName` index
- `src/lib/xlsxImportRunner.ts` — Early idempotency mark, name-based note fallback
- `src/lib/xlsx/columnMapping.ts` — `REQUIRED_FIELDS` reduced to `['Name']`
- `src/lib/xlsx/index.ts` — Updated comment to reflect optional barcode
- `src/lib/__tests__/xlsxPreview.test.ts` — Updated tests for name-fallback behavior
- `src/lib/__tests__/xlsxImportRunner.test.ts` — 25 comprehensive tests
- `src/lib/__tests__/xlsxParser.test.ts` — Updated barcode-optional parser tests

**Key Decisions:**
- Barcode optional in REQUIRED_FIELDS (intentional — real-world xlsx files lack barcodes)
- Barcode-first + name-fallback matching (prevents duplicates while respecting barcode priority)
- Separate but identical action resolution function for clarity
- Batch-based idempotency using file hash + row identifiers
- Shared diff detection via `buildInvoiceProductUpdatePayload()`
- Early state mutation for race condition prevention
