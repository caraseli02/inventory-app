---
status: complete
priority: p1
issue_id: "011"
tags: [code-review, data-integrity, invoice-import]
dependencies: []
---

# Invoice import creates duplicates for repeated names

The invoice import path can create duplicate product records when the same product name appears multiple times in one invoice and barcode is missing.

## Problem Statement

Invoice rows are matched against a normalized-name map built from the pre-import product list only. Newly created products are not added back into that map during the same import run. As a result, repeated rows in one invoice can create duplicate products instead of updating/stocking a single product.

## Findings

- `src/pages/InventoryListPage.tsx:304` creates `normalizedNameMap` once from `products` state.
- `src/pages/InventoryListPage.tsx:336` creates a new product when no match is found.
- There is no `normalizedNameMap.set(...)` after creation, so later rows in the same batch cannot match the just-created product.
- Impact: duplicate SKUs and fragmented stock history from a single import action.

## Proposed Solutions

### Option 1: Update in-memory map after create (recommended)

After `createProduct`, insert the returned product into `normalizedNameMap` by normalized name and barcode cache.

**Pros:**
- Minimal change.
- Fixes same-batch duplicates immediately.

**Cons:**
- Keeps current sequential import architecture.

**Effort:** Small

**Risk:** Low

---

### Option 2: Pre-group invoice rows by matching key

Group rows by barcode/name before writes and execute one create/update per group, summing stock deltas.

**Pros:**
- Deterministic dedupe and fewer DB calls.

**Cons:**
- Larger refactor.
- More edge-case handling.

**Effort:** Medium

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `src/pages/InventoryListPage.tsx:304`
- `src/pages/InventoryListPage.tsx:336`

## Resources

- Review branch: `codex/invoice-pricing-parity-weight-edit`

## Acceptance Criteria

- [ ] Repeated invoice rows with the same normalized name do not create duplicate products.
- [ ] Repeated invoice rows produce one product with cumulative stock movements.
- [ ] Manual test with missing-barcode repeated rows passes.

## Work Log

### 2026-02-11 - Code Review Discovery

**By:** Codex

**Actions:**
- Reviewed invoice import matching flow.
- Traced control flow for same-batch repeated names.
- Confirmed map is not updated after creation.

**Learnings:**
- Name-based matching is present but not stateful across the current import loop.

## Notes

- This is merge-blocking for invoice imports where suppliers split the same product across multiple lines.

### 2026-02-11 - Fix Implemented

**By:** Codex

**Actions:**
- Updated invoice import flow to maintain `normalizedNameMap` during processing.
- Added map updates when matching existing products and after creating new products.
- Prevented same-batch duplicate creates for repeated normalized names.

**Learnings:**
- Stateful in-memory matching is enough to fix same-invoice duplicate creation in frontend-led import.
