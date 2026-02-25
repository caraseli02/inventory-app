---
module: InventoryListPage
date: 2026-02-25
problem_type: logic_error
component: page_component
symptoms:
  - "Multiple KG vrac items with same name collapsed into 1 product instead of N separate products"
  - "Stock accumulates on first created product (e.g. stock=5) instead of spreading across products (5×stock=1)"
  - "User-selected 'New product / create' action silently ignored for rows 2-N when name matches a previously created row"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [invoice-import, bulk-import, kg-vrac, name-dedup, barcode, import-action, normalizedNameMap]
related_github_issue: null
commit: 2941340
---

# Problem Description

When importing an invoice containing multiple KG vrac (bulk weighed) items with the same generic name
but distinct barcodes (e.g. 5× "DOCTORSCAIA FILLETTI VRAC" each representing a different weighed portion),
only the **first item was created** as a new Supabase product. Items 2–5 silently updated the first product
via name-based deduplication and added stock movements to it. Result: **1 product with stock=5** instead of
**5 products each with stock=1**.

# Symptoms

- After invoice import, inventory shows 1 product where 5 were expected
- The single product has stock equal to the number of invoice rows (e.g. 5)
- Product's barcode matches only the **first** imported row's barcode
- All subsequent rows' prices, weights, and barcodes are discarded
- No error shown to the user — import reports "success"

Steps to reproduce:
1. Import an invoice containing 5+ rows with identical name but different barcodes
2. Mark all rows as "New product" (create)
3. Confirm import
4. Search inventory — only 1 product appears, stock = number of rows

# Root Cause Analysis

In `src/pages/InventoryListPage.tsx:handleImport` (invoice import branch), product lookup uses two strategies in sequence:

1. **Barcode lookup** — calls `getProductByBarcode(importedBarcode)` against Supabase
2. **Name fallback** — checks `normalizedNameMap` (a local map built from `allProducts` + updated during the import loop)

When item 1 is created, its name is added to `normalizedNameMap`. When item 2 arrives with the same name
but a different barcode:

- Barcode lookup → `null` (unique barcode, not in DB yet)
- Name fallback → **finds item 1** in `normalizedNameMap`
- Code enters the **update path** instead of the create path
- Stock movement quantity 1 is added to item 1

This repeats for items 3–5. The `importAction === 'create'` flag set by the user was never checked before
running the name fallback.

```typescript
// ❌ BEFORE — name fallback unconditional, overrides user intent
if (importedBarcode) {
  existing = await getProductByBarcode(importedBarcode);
}
if (!existing) {
  existing = normalizedNameMap.get(normalizeName(imported.Name)) ?? null;
}
```

# Solution

Guard the name-based fallback with `importAction !== 'create'`. When the user explicitly chose to create
a new product, skip name-based dedup and go straight to the create path. Barcode-based dedup still applies
(barcodes are globally unique identifiers, so a barcode match always takes precedence regardless of intent).

```typescript
// ✅ AFTER — name fallback skipped when user explicitly chose 'create'
if (importedBarcode) {
  existing = await getProductByBarcode(importedBarcode);
}
// Skip name-based lookup when user explicitly chose 'create' — respects intent
// for KG vrac items that share a generic name but are distinct products.
if (!existing && importAction !== 'create') {
  existing = normalizedNameMap.get(normalizeName(imported.Name)) ?? null;
}
```

**Why this is safe:**
- `importAction === 'create'` means the user saw the row in the preview UI and explicitly marked it as a new product
- Barcode dedup is preserved: if two rows share a barcode (which should be globally unique), they still correctly resolve to the same product
- Name dedup for `update` and default actions is unchanged — cross-session duplicates without barcodes still merge correctly

# Files Changed

- `src/pages/InventoryListPage.tsx` (line ~407, inside `handleImport` invoice import branch)

# Prevention

- [ ] Add unit test: 5 rows same name + different barcodes + `importAction='create'` → 5 products created
- [ ] Add unit test: `importAction='create'` ignores existing product found by name
- [ ] Add unit test: `importAction='update'` still uses name fallback when barcode misses

**Lookup resolution order to document in code:**
```typescript
// Resolution order for invoice import rows:
// 1. Explicit ID  — only when importAction='update' AND existingProductId is set
// 2. Barcode      — always (barcodes are global identity; match overrides intent)
// 3. Name fallback — ONLY when importAction !== 'create' (prevents merging intentional duplicates)
```

**Antipattern to avoid — "Silent Intent Override":**
Any fallback lookup in a bulk operation must check the user's explicit action signal before running.
If the user says "create", downstream code must not silently redirect to "update".

# Related

- `docs/solutions/logic-errors/invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md` — earlier dedup fix (filtered list vs allProducts)
- `todos/011-complete-p1-invoice-import-duplicate-name-creation.md` — normalizedNameMap not updated during batch
- `todos/016-complete-p1-invoice-import-matching-uses-filtered-products.md` — filtered products causing missed matches
- `todos/017-complete-p2-invoice-import-barcode-normalization-consistency.md` — barcode trimming prerequisite
- PR #132: `fix/invoice-import-create-name-dedup`
