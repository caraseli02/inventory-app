---
module: InvoiceUploadDialog
date: 2026-02-06
problem_type: logic_error
component: dialog_component
symptoms:
  - "MDL unit costs imported as EUR prices"
  - "Invoice totals did not match converted unit prices"
  - "Existing matches skipped with no update option"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [invoice-ocr, pricing, fx-rate, mdl-eur, import]
related_github_issue: null
commit: null
---

# Problem Description

Invoice OCR imports were mapping MDL unit costs directly into EUR pricing fields. This inflated base prices, produced incorrect totals, and skipped matched products without user choice. Categories were often missing, forcing manual cleanup.

# Symptoms

- MDL unit costs treated as EUR after import
- Totals mismatched when recalculating from unit price
- Missing categories in preview/import
- Existing product matches skipped with no update choice

# Root Cause Analysis

The invoice import flow trusted OCR prices without FX conversion and left categories undefined. The import mapping treated any barcode match as a skip with no per-item update choice.

```typescript
// ❌ BEFORE - No FX conversion or category assignment
const importedProducts = editableProducts.map((product) => ({
  Name: product.name,
  Barcode: product.barcode || '',
  Category: undefined,
  Price: product.unitPrice,
  currentStock: product.quantity,
}));
```

# Solution

Add BNM FX rate fetch (with fallback and manual override), convert MDL to EUR, recompute totals from quantity × converted unit price, set only the active 70% tier, and add per-item update/skip for matches. Auto-assign categories via AI/heuristics with editable preview.

```typescript
// ✅ AFTER - FX conversion + per-item update/skip
const price70 = roundCurrency(product.unitPrice * 1.7);
return {
  Name: product.name,
  Barcode: product.barcode || '',
  Category: product.category || 'General',
  Price: product.unitPrice,
  price70,
  importAction,
};
```

# Files Changed

- `src/components/invoice/InvoiceUploadDialog.tsx`
- `src/lib/exchangeRates.ts`
- `src/pages/InventoryListPage.tsx`
- `src/lib/xlsx/index.ts`

# Prevention

- [ ] Add a fixture PDF that OCR reliably parses for preview-level tests
- [ ] Add a unit test for MDL→EUR conversion and total recompute logic
- [ ] Add UI test for update/skip choices on matched items
