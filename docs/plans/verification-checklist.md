# Excel Import Parity Verification Checklist

## Requirement Verification

### R1: Excel import computes match results by barcode ✓
**Location**: `src/lib/xlsx/preview.ts:91-95`
```typescript
const productByBarcode = new Map<string, Product>();
allProducts.forEach((product) => {
  const barcode = normalizeBarcode(product.fields.Barcode);
  if (barcode) productByBarcode.set(barcode, product);
});
```
**Status**: ✓ IMPLEMENTED - Barcode-only matching (no name fallback, as designed)

### R2: Excel import detects meaningful catalog diffs ✓
**Location**: `src/lib/xlsx/preview.ts:100-101`
```typescript
const payload = matchedProduct ? buildInvoiceProductUpdatePayload(matchedProduct, product) : {};
const hasDiffs = Object.keys(payload).length > 0;
```
**Status**: ✓ IMPLEMENTED - Uses shared `buildInvoiceProductUpdatePayload()` from invoice imports

### R3: Excel import resolves default actions per row ✓
**Location**: `src/lib/xlsx/preview.ts:22-30, 104-108`
```typescript
function getDefaultExcelImportAction(input: {
  hasMatch: boolean;
  isAlreadyImported: boolean;
  hasDiffs: boolean;
}): XlsxImportAction {
  if (!input.hasMatch) return 'create';
  if (input.isAlreadyImported) return input.hasDiffs ? 'update' : 'skip';
  return input.hasDiffs ? 'update' : 'receive_stock';
}
```
**Status**: ✓ IMPLEMENTED - Same logic as invoice import (`getDefaultInvoiceImportAction`)

### R4: Excel import skips already-imported rows ✓
**Location**: `src/lib/xlsxImportRunner.ts:51-62, 268`
```typescript
// Loading already-imported IDs
async function loadAlreadyImportedExcelIds(firstRow: ImportedProduct | undefined): Promise<Set<string>> {
  if (!firstRow?.excelBatchId) return new Set();
  return await getAlreadyImportedExcelRowIds({ batchId: firstRow.excelBatchId });
}

// Checking at import time
const isAlreadyImportedRow = Boolean(rowId && state.alreadyImportedRowIds.has(rowId));
```
**Status**: ✓ IMPLEMENTED - Batch-based idempotency via `excelBatchId` and `excelRowId`

### R5: Excel import applies updates and stock receipts ✓
**Location**: `src/lib/xlsxImportRunner.ts:152-190`
```typescript
async function handleExistingRow(input: {
  existing: Product;
  imported: ImportedProduct;
  importAction: NonNullable<ImportedProduct['importAction']>;
  isAlreadyImportedRow: boolean;
  rowId: string | undefined;
  state: XlsxImportState;
  result: ImportResult;
  t: TFunction;
}): Promise<void> {
  // ...
  if (importAction === 'update') {
    await maybeApplyUpdate(existing, imported, state);
  }

  if (!isAlreadyImportedRow) {
    const partialMessage = await addExcelStockMovement({...});
  }
  // ...
}
```
**Status**: ✓ IMPLEMENTED - Updates apply via `buildInvoiceProductUpdatePayload()`, stock via `addStockMovement()`

### R6: Excel import creates new products for unmatched barcodes ✓
**Location**: `src/lib/xlsxImportRunner.ts:192-243`
```typescript
async function handleCreateRow(input: {
  imported: ImportedProduct;
  importAction: NonNullable<ImportedProduct['importAction']>;
  isAlreadyImportedRow: boolean;
  rowId: string | undefined;
  state: XlsxImportState;
  result: ImportResult;
  t: TFunction;
}): Promise<void> {
  const newProduct = await createProduct({
    Name: imported.Name,
    Barcode: normalizeBarcode(imported.Barcode),
    Category: imported.Category,
    Price: imported.Price,
    'Price 50%': imported.price50,
    'Price 70%': imported.price70,
    'Price 100%': imported.price100,
    Markup: 70,
    'Expiry Date': imported.expiryDate,
    Supplier: imported.Supplier,
  });
  // ... stock movement
}
```
**Status**: ✓ IMPLEMENTED - Creates products and adds stock when quantity present

### R7: Excel import shows clear preview with resolved actions ✓
**Location**: `src/components/xlsx/ImportDialog.tsx:97, 334-338`
```typescript
setPreviewRows(buildXlsxPreviewRows(result.products, products, alreadyImportedRowIds));

// ...

<ImportPreviewTable
  rows={previewRows}
  t={t}
  onActionChange={handleActionChange}
/>
```
**Status**: ✓ IMPLEMENTED - Preview shows match status, diffs, actions; user can override

## Parity Analysis: Excel vs Invoice Import

### Shared Components
- ✓ Diff detection: Both use `buildInvoiceProductUpdatePayload()` from `invoiceImportDiffs.ts`
- ✓ Action resolution: Same logic (separate but identical functions)
- ✓ Stock movement: Both use `addStockMovement()`
- ✓ Product CRUD: Both use `createProduct()`, `updateProduct()` via `api-provider.ts`

### Intentional Differences
- ✓ Matching: Excel = barcode-only; Invoice = barcode OR name (design choice per requirements)
- ✓ Idempotency: Excel = batch hash; Invoice = supplier+invoice number
- ✓ Workflow: Excel = simpler, deterministic; Invoice = more complex with OCR/extraction

## Test Coverage Analysis

### Existing Tests (`src/lib/__tests__/xlsxPreview.test.ts`)
- ✓ Match with no diffs → `receive_stock`
- ✓ Match with diffs → `update`
- ✓ Already imported, unchanged → `skip`
- ✓ Missing barcode → blocking error

### Missing Test Coverage
1. **No match scenarios**:
   - No barcode match → `create` action
   - Already imported, no match → `skip` action
2. **Diff-specific scenarios**:
   - Match with price diffs only → `update`
   - Match with supplier diffs only → `update`
   - Match with category diffs only → `update`
3. **Edge cases**:
   - Barcode with whitespace → should trim and match
   - Empty barcode field → blocking error
   - `existingProductId` points to deleted product → should resolve to null
4. **Idempotency scenarios**:
   - First import → stock added
   - Re-import same batch → duplicate skip
5. **xlsxImportRunner tests**: File doesn't exist yet

## Gaps Identified

### 1. Missing Test File
**File**: `src/lib/__tests__/xlsxImportRunner.test.ts`
**Impact**: No test coverage for the actual import execution logic
**Priority**: HIGH

### 2. Missing Test Scenarios in xlsxPreview.test.ts
**Impact**: Incomplete coverage of edge cases and diff scenarios
**Priority**: MEDIUM

### 3. Integration Tests
**File**: `tests/integration/xlsx-import.test.ts`
**Impact**: No end-to-end verification of parity with invoice import
**Priority**: MEDIUM

## Behavioral Verification Needed

### Edge Case: Deleted Product
**Question**: What happens when `existingProductId` points to a deleted product?
**Analysis**: In `resolveExistingProduct()`:
```typescript
if (imported.existingProductId) {
  const byId = state.productById.get(imported.existingProductId) ?? null;
  if (byId) return byId;
}
const importedBarcode = normalizeBarcode(imported.Barcode);
if (!importedBarcode) return null;
return getProductByBarcode(importedBarcode);
```
**Result**: ✓ HANDLED - Falls back to barcode lookup; if still not found, returns null

## Conclusion

**All requirements (R1-R7) are IMPLEMENTED.**

The Excel import feature has full parity with invoice import for:
- Match resolution (barcode-only, by design)
- Diff detection (shared logic)
- Default action resolution (identical logic)
- Idempotency (batch-based)
- Update + stock receipt
- New product creation
- Preview display

**Next steps**: Add missing test coverage to ensure these features are properly tested and maintained.
