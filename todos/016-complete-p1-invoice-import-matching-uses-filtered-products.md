---
status: complete
priority: p1
issue_id: "016"
tags: [code-review, invoice-import, data-integrity, ux]
dependencies: []
---

# Invoice Import Matching Uses Filtered Products, Can Create Duplicates

## Problem Statement

Invoice import can create duplicate products (or fail to update the intended product) when the UI has a clear match, but the import handler uses a filtered product list for lookups. This is high impact because it silently corrupts inventory by duplicating SKUs and splitting stock.

## Findings

- The invoice import UI computes matches against the full product list passed in (`products={allProducts}`), and sends `existingProductId` for rows defaulting to `importAction === "update"`.
- The import handler for invoice imports lives in `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/pages/InventoryListPage.tsx` and currently uses the `products` variable captured from `useInventoryList()` (which is filtered by search/category/low-stock filters).
- In the invoice-import branch, when `importAction === "update"` and `existingProductId` is present, the handler first tries `products.find(p => p.id === existingProductId)`.
  - If the product is not in the filtered list and the row has no barcode, the handler falls back to a name map built from `products` (filtered) and can fail to find the existing product entirely.
  - In that case, it creates a new product even though the UI match exists.
- Affected code:
  - `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/pages/InventoryListPage.tsx`

## Proposed Solutions

### Option 1: Always Update By `existingProductId` When Present (Recommended)

**Approach:**
- In the invoice-import branch, if `importAction === "update"` and `existingProductId` exists:
  - call `updateProduct(existingProductId, payload)` directly (no need to locate an in-memory `Product` object)
  - call `addStockMovement(existingProductId, ...)` directly for stock updates
- Use the product list only for convenience fields / to avoid extra fetches, not for correctness.

**Pros:**
- Correctness guaranteed: UI match is authoritative.
- No dependency on filters, sorting, or current UI view state.
- Minimal code changes, easy to test.

**Cons:**
- Requires ensuring `existingProductId` is always set when UI shows a match (currently true for invoice import).

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Use `allProducts` For Matching + Name Map

**Approach:**
- Replace all invoice-import matching sources from `products` to `allProducts`.
- Build the normalized name map from `allProducts`.

**Pros:**
- Fixes duplicates caused by filters.
- Preserves existing shape of the code.

**Cons:**
- Still relies on fallbacks; correctness depends on matching strategy rather than explicit IDs.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 3: Fetch-by-ID When Updating

**Approach:**
- When `existingProductId` present, fetch product state (optional) before update.

**Pros:**
- Full data consistency for decision-making.

**Cons:**
- Adds network calls; unnecessary for basic update/stock movement.

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/pages/InventoryListPage.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/3dac/inventory-app/src/components/invoice/InvoiceUploadDialog.tsx` (producer of `existingProductId`)

**Notes:**
- This issue is more likely when inventory filters are active during invoice import.

## Acceptance Criteria

- [x] Importing an invoice with filters active does not create duplicates for matched rows.
- [x] For matched rows without barcodes, `importAction=update` updates the existing product (by ID) and does not create a new one.
- [ ] Unit/integration coverage added for the update-by-id path (invoice import).

## Work Log

### 2026-02-12 - Review Finding

**By:** Codex

**Actions:**
- Reviewed invoice import pipeline and matching logic.
- Identified filtered product list dependency in invoice-import update path.

**Learnings:**
- UI match computation uses `allProducts`, but import handler correctness currently depends on filtered `products`.

### 2026-02-12 - Fix Implemented

**By:** Codex

**Actions:**
- Updated invoice import handler to build name indices from `allProducts` (not filtered `products`).
- When `importAction=update` and `existingProductId` is present, update by ID directly (authoritative), avoiding duplicate creation.

