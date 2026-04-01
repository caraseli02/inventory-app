---
title: feat: Excel import parity with invoice import
type: feat
status: active
date: 2026-03-31
origin: docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md
---

# Excel Import Parity with Invoice Import

## Overview

Bring Excel import to full behavioral parity with invoice import for match resolution, diff detection, and default action handling. The Excel import path already implements most of these features via `src/lib/xlsx/preview.ts` and `src/lib/xlsxImportRunner.ts`, but this plan verifies completeness and addresses any remaining gaps.

## Problem Frame

Invoice import and Excel import should reach equivalent inventory outcomes for normal delivery intake, with Excel maintaining stricter barcode-only matching per the canonical fallback design. A review of the codebase reveals that most parity work is already implemented, but verification and potential refinement are needed to ensure the two paths are truly aligned.

## Requirements Trace

- R1. Excel import must compute match results by barcode (invoice uses barcode OR name)
- R2. Excel import must detect meaningful catalog diffs between imported and existing products
- R3. Excel import must resolve default actions per row based on match status and diffs
- R4. Excel import must skip already-imported rows from the same batch
- R5. Excel import must apply updates and stock receipts as part of matched row intake
- R6. Excel import must create new products for unmatched barcodes
- R7. Excel import must show clear preview with resolved actions before import

## Scope Boundaries

- **Intentional non-parity**: Excel import requires barcodes and does NOT support name-only matching (per requirements doc R4)
- **Intentional non-parity**: Excel import uses a simpler, more predictable workflow without invoice extraction complexity
- **Out of scope**: Arbitrary spreadsheet format support beyond the canonical template
- **Out of scope**: Name-based matching fallback for Excel rows

## Context & Research

### Relevant Code and Patterns

#### Excel Import (Current Implementation)

**`src/lib/xlsx/preview.ts`** (ALREADY IMPLEMENTED):
- `buildXlsxPreviewRows()` - Computes match results, diffs, and default actions
- Barcode-only matching via `productByBarcode` map
- Diff detection via `buildInvoiceProductUpdatePayload()` (shared with invoice!)
- Default action resolution via `getDefaultExcelImportAction()` (same logic as invoice)
- Blocking error detection for missing barcodes
- `getAvailableExcelActions()` for UI controls

**`src/lib/xlsxImportRunner.ts`** (ALREADY IMPLEMENTED):
- `runXlsxImport()` - Full import execution
- `loadAlreadyImportedExcelIds()` - Batch idempotency
- `resolveExistingProduct()` - Product resolution by ID or barcode
- `handleExistingRow()` - Handles `update` and `receive_stock` for matched products
- `handleCreateRow()` - Handles `create` for new products
- Stock movement integration via `addStockMovement()`

**`src/components/xlsx/ImportDialog.tsx`** (ALREADY IMPLEMENTED):
- Uses `buildXlsxPreviewRows()` to compute preview state
- Displays match results, diffs, and default actions in preview table
- Action override UI via `ImportPreviewTable`
- Idempotency checks via `getAlreadyImportedExcelRowIds()`

#### Invoice Import (Reference Implementation)

**`src/lib/invoiceImportDiffs.ts`** (SHARED WITH EXCEL):
- `hasMeaningfulInvoiceDiffs()` - Diff detection for Price, Supplier, Category
- `getDefaultInvoiceImportAction()` - Default action logic (Excel has separate but identical function)
- `buildInvoiceProductUpdatePayload()` - Update payload construction (SHARED)

**`src/hooks/useInvoiceComputed.ts`** (REFERENCE):
- `computeMatchResults()` - Matches by barcode OR name (Excel intentionally uses barcode-only)
- `computeRowFlags()` - Sets `isAlreadyImported`, `hasDiffs` flags

### Institutional Learnings

- `docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md` - Defines Excel fallback as canonical template, barcode-only workflow
- Invoice import uses name matching as a fallback because OCR extraction may fail; Excel has no such ambiguity
- Both paths share the same diff detection logic via `buildInvoiceProductUpdatePayload()`

### External References

None needed - this is internal parity work based on existing invoice patterns.

## Key Technical Decisions

- **Reuse invoice diff logic**: Excel already uses `buildInvoiceProductUpdatePayload()` from invoice imports, ensuring consistent diff detection
- **Separate but identical action resolution**: `getDefaultExcelImportAction()` mirrors `getDefaultInvoiceImportAction()` for clarity, even though logic is the same
- **Barcode-only matching**: Enforced per requirements doc; name matching would reintroduce invoice-style ambiguity
- **Batch-based idempotency**: Uses file hash (`excelBatchId`) and row identifiers to prevent duplicate stock receipts

## Open Questions

### Resolved During Planning

- **Q1**: Does Excel import already compute match results and diffs?
  - **A**: Yes - `buildXlsxPreviewRows()` in `src/lib/xlsx/preview.ts` implements this
- **Q2**: Does Excel import already resolve default actions?
  - **A**: Yes - `getDefaultExcelImportAction()` implements the same logic as invoice import
- **Q3**: Is there a gap in the current implementation?
  - **A**: Code review shows most parity features are already implemented. This plan focuses on verification and addressing any edge cases.

### Deferred to Implementation

- [Verification] Test coverage gaps in `xlsxPreview.test.ts` - may need additional test scenarios for diff/action resolution
- [Verification] UI clarity - whether the preview table clearly communicates match status and default actions to users
- [Potential edge case] Behavior when `existingProductId` points to a deleted product

## Implementation Units

### Unit 1: Verify and Document Current Implementation

**Goal:** Confirm that Excel import already implements invoice-style matching, diff detection, and action resolution. Document any gaps found.

**Requirements:** R1, R2, R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Read: `src/lib/xlsx/preview.ts`, `src/lib/xlsxImportRunner.ts`, `src/components/xlsx/ImportDialog.tsx`
- Read: `src/hooks/useInvoiceComputed.ts`, `src/lib/invoiceImportDiffs.ts`
- Modify: `docs/plans/2026-03-31-001-feat-excel-invoice-import-parity-plan.md` (add verification notes)
- Test: Run existing tests in `src/lib/__tests__/xlsxPreview.test.ts`

**Approach:**
- Trace through `buildXlsxPreviewRows()` execution flow
- Verify diff detection uses shared `buildInvoiceProductUpdatePayload()`
- Verify default action logic matches invoice import behavior
- Check idempotency handling in `runXlsxImport()`
- Compare error handling between Excel and invoice paths
- Document any behavioral discrepancies found

**Patterns to follow:**
- Invoice import patterns in `src/hooks/useInvoiceComputed.ts` and `src/lib/importRunners.ts`

**Test scenarios:**
- **Happy path**: Barcode match with no diffs → action = `receive_stock`
- **Happy path**: Barcode match with diffs → action = `update`
- **Happy path**: No barcode match → action = `create`
- **Happy path**: Already-imported row → action = `skip` (or `update` if diffs)
- **Edge case**: Missing barcode → blocking error
- **Edge case**: Existing product deleted before import → verify error handling
- **Integration**: Full import flow with mixed match/diff combinations

**Verification:**
- Checklist confirming each requirement (R1-R7) is implemented
- List of any genuine gaps discovered
- Test coverage report for `xlsxPreview.test.ts`

### Unit 2: Add Missing Test Coverage (if needed)

**Goal:** Ensure `xlsxPreview.test.ts` has comprehensive coverage of match, diff, and action resolution scenarios.

**Requirements:** R1, R2, R3, R4, R5, R6, R7

**Dependencies:** Unit 1 (verification)

**Files:**
- Modify: `src/lib/__tests__/xlsxPreview.test.ts`
- Modify: `src/lib/__tests__/xlsxImportRunner.test.ts` (may need new tests)

**Approach:**
- Add test cases for each scenario in Unit 1's test list
- Cover edge cases: missing barcodes, deleted products, malformed data
- Test action overrides and blocking errors
- Verify idempotency behavior

**Patterns to follow:**
- Existing test patterns in `src/lib/__tests__/invoiceImportDiffs.test.ts`

**Test scenarios:**
- **Barcode match scenarios**:
  - Match with no diffs → `receive_stock` action
  - Match with price diffs → `update` action
  - Match with supplier diffs → `update` action
  - Match with no diffs, already imported → `skip` action
  - Match with price diffs, already imported → `update` action
- **No match scenarios**:
  - No barcode match → `create` action
  - Already imported, no match → `skip` action
- **Blocking error scenarios**:
  - Missing barcode → blocking error
  - Zero/negative quantity with `receive_stock` → blocking error
- **Idempotency scenarios**:
  - First import → stock added
  - Re-import same batch → duplicate skip
- **Edge cases**:
  - Barcode with whitespace → should trim and match
  - Empty barcode field → blocking error
  - `existingProductId` points to deleted product → should resolve to null

**Verification:**
- All tests pass
- Coverage report shows >90% for `src/lib/xlsx/preview.ts`
- Coverage report shows >90% for `src/lib/xlsxImportRunner.ts`

### Unit 3: Address Any Genuine Gaps (if found)

**Goal:** Implement any missing features discovered during verification.

**Requirements:** Any requirements not satisfied by current implementation

**Dependencies:** Unit 1 (verification)

**Files:**
- **Conditional**: Modify `src/lib/xlsx/preview.ts` if gaps found
- **Conditional**: Modify `src/lib/xlsxImportRunner.ts` if gaps found
- **Conditional**: Modify `src/components/xlsx/ImportDialog.tsx` if UI gaps found
- Test: `src/lib/__tests__/xlsxPreview.test.ts`, `src/lib/__tests__/xlsxImportRunner.test.ts`

**Approach:**
- **Skip if no gaps**: If Unit 1 finds all features implemented, note this and proceed to Unit 4
- **Implement gaps**: If gaps exist, implement following invoice import patterns
- Focus on parity of outcome, not identical code paths

**Patterns to follow:**
- Invoice import patterns in `src/hooks/useInvoiceComputed.ts` and `src/lib/importRunners.ts`

**Test scenarios:**
- [Specific to any gaps discovered]

**Verification:**
- All requirements R1-R7 satisfied
- Behavior matches invoice import for equivalent scenarios (excepting intentional differences)

### Unit 4: UI Clarity and User Experience Verification

**Goal:** Ensure the Excel import preview clearly communicates match status, diffs, and default actions to users.

**Requirements:** R7

**Dependencies:** Unit 2 (test coverage), Unit 3 (gap implementation, if needed)

**Files:**
- Read: `src/components/xlsx/ImportPreviewTable.tsx`
- **Conditional**: Modify `src/components/xlsx/ImportPreviewTable.tsx` if clarity gaps found
- Test: `src/components/__tests__/xlsx/ImportPreviewTable.test.ts` (may need to create)

**Approach:**
- Review preview table UI for clarity
- Verify match status is visible (matched vs unmatched)
- Verify diffs are highlighted when present
- Verify default action is clear and editable
- Verify blocking errors are prominent
- Compare UI to invoice import preview for parity

**Patterns to follow:**
- Invoice import preview UI in `src/components/invoice-upload/` (if exists)

**Test scenarios:**
- **Happy path**: Preview table shows match status, action selector, and diff indicators
- **Happy path**: User can override default action
- **Happy path**: Action changes update blocking errors dynamically
- **Edge case**: Blocking error prevents import
- **Integration**: Full flow from file upload to import confirmation

**Verification:**
- Preview table communicates all relevant information clearly
- User can understand what will happen before confirming import
- UI matches invoice import preview clarity (excepting invoice-specific fields)

### Unit 5: Integration Testing and Documentation

**Goal:** Verify end-to-end Excel import behavior matches invoice import outcomes for equivalent delivery data.

**Requirements:** R1, R2, R3, R4, R5, R6, R7

**Dependencies:** Units 1-4

**Files:**
- Test: `tests/integration/xlsx-import.test.ts` (create if needed)
- Modify: `docs/plans/2026-03-31-001-feat-excel-invoice-import-parity-plan.md` (add integration results)
- **Optional**: Update `docs/specs/xlsx_integration.md` if parity behavior needs documentation

**Approach:**
- Create integration test that imports same delivery data via both Excel and invoice
- Verify both paths reach equivalent inventory state
- Test batch idempotency (re-import should skip)
- Test error recovery (partial failures)
- Document any behavioral differences and rationale

**Patterns to follow:**
- Invoice import integration tests (if exist)

**Test scenarios:**
- **Integration**: Import 10-row delivery with 6 matches (3 with diffs, 3 without) and 4 new products
- **Integration**: Re-import same Excel batch → verify no duplicate stock
- **Integration**: Mixed success/failure batch → verify partial success handling
- **Comparison**: Same delivery via Excel vs invoice → verify equivalent outcome

**Verification:**
- Integration tests pass
- Excel and invoice imports reach equivalent inventory state for same delivery
- Idempotency prevents duplicate stock receipts
- Documentation updated with parity confirmation

## System-Wide Impact

- **Interaction graph:** `ImportDialog` → `buildXlsxPreviewRows` → preview state → user confirmation → `runXlsxImport` → API calls (`createProduct`, `updateProduct`, `addStockMovement`)
- **Error propagation:** Errors in `runXlsxImport` propagate to `ImportDialog` as toast messages; fatal errors stop import; partial errors allow completion with warnings
- **State lifecycle risks:**
  - Product deleted between preview and import → handled by `resolveExistingProduct()` returning null
  - Race condition on concurrent imports → mitigated by `buildProductById()` creating snapshot at import start
- **API surface parity:** Excel import uses same API functions as invoice import (`createProduct`, `updateProduct`, `addStockMovement`) via shared `api-provider.ts`
- **Integration coverage:** Unit tests cover individual functions; integration tests should cover full flow with real API calls
- **Unchanged invariants:**
  - Invoice import name-matching behavior is unchanged
  - Excel import continues to require barcodes (no name fallback)
  - Both paths use shared `buildInvoiceProductUpdatePayload()` for diff detection

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Parity verification reveals unexpected gaps | Unit 1 is primarily investigative; Unit 3 implements any discovered gaps |
| Test coverage is inadequate | Unit 2 explicitly adds missing test scenarios |
| UI doesn't clearly communicate actions | Unit 4 verifies UI clarity and implements improvements |
| Integration tests reveal subtle behavioral differences | Unit 5 compares Excel vs invoice outcomes directly and documents differences |

## Documentation / Operational Notes

- Update `docs/specs/xlsx_integration.md` if parity behavior needs explicit documentation
- Add integration test results to plan as verification of parity
- Consider adding "Excel vs Invoice Import" comparison section to user docs

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-29-excel-import-fallback-requirements.md](../brainstorms/2026-03-29-excel-import-fallback-requirements.md)
- Related code: `src/lib/xlsx/preview.ts`, `src/lib/xlsxImportRunner.ts`, `src/lib/invoiceImportDiffs.ts`
- Related code: `src/hooks/useInvoiceComputed.ts`, `src/hooks/useInvoiceImport.ts`
- Related tests: `src/lib/__tests__/xlsxPreview.test.ts`, `src/lib/__tests__/invoiceImportDiffs.test.ts`
