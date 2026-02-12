---
title: "fix: Checkout uses base cost instead of store (markup) price"
type: fix
date: 2026-02-12
---

# fix: Checkout uses base cost instead of store (markup) price

## Overview

Checkout mode currently displays and totals using the product **base cost** (`fields.Price`) instead of the product’s **store price** derived from its markup tier (`fields.Markup` + `fields['Price 50%|70%|100%']`).

This causes a visible mismatch between inventory/listing screens (which already use markup-aware display pricing) and checkout/cart screens.

## Problem Statement

Example from current UI:

- Product base price: `€5.12` (`fields.Price`)
- Product markup tier: `70%` (`fields.Markup`)
- Product store price: `€9.98` (`fields['Price 70%']`)
- Checkout/cart shows: `€5.12` and totals from `€5.12` (incorrect; should be `€9.98`)

## Root Cause (Confirmed in Code)

Checkout uses base price directly:

- `src/pages/CheckoutPage.tsx`: totals and review modal unit price use `item.product.fields.Price` (see `calculateTotals()` and review list rendering).
- `src/components/cart/CartItem.tsx`: unit price badge uses `item.product.fields.Price`.
- `src/components/search/ProductBrowsePanel.tsx`, `src/components/search/ProductSearchDropdown.tsx`, `src/components/search/QuickAddGrid.tsx`: product cards show `product.fields.Price` while in checkout flow.

Inventory/listing already uses markup-aware display pricing:

- `src/hooks/useMarkupSetting.ts`: `getProductDisplayPrice(product)` selects `Price 50%|70%|100%` based on `Markup`, with fallback to `Price`.
- `src/components/inventory/ProductListItem.tsx` and `src/components/inventory/InventoryTable.tsx`: display price uses `getProductDisplayPrice(product.fields)`.

## Assumptions (Call Out)

- Checkout should charge/display the **store price** for the product’s current markup tier (`fields.Markup`).
- If a product’s tier price is missing, fallback behavior should be explicit (warn and/or block), not silent.

Open question:

- Should checkout always use product-level `fields.Markup` (recommended), or should it force a global tier (e.g., always 70%)?

## Proposed Solution

### 1) Make checkout price source markup-aware

Use `getProductDisplayPrice(item.product.fields)` wherever checkout currently uses `item.product.fields.Price`:

- cart item unit price
- cart totals
- review modal unit price and line totals

This aligns checkout with inventory listing behavior and the product edit screen’s “Preț în magazin”.

### 2) Handle missing tier prices deliberately

Two acceptable behaviors (pick one; default to A):

1. A (recommended, minimal disruption): display fallback price but warn
  - Display: `displayPrice = getProductDisplayPrice(fields)` (may fall back to base)
  - Missing counter: treat “missing” as “tier price missing for active markup OR base missing”
  - UI: show existing missing price warning if any item lacks tier/base price
2. B (strict): block checkout when tier price missing
  - If active tier price is missing, show `—` for that item and disable “Complete checkout” until resolved

Note: option A keeps current flow usable while still surfacing data gaps.

### 3) Keep “inventory/manage” semantics unchanged

This fix should be scoped to checkout and its “add to cart” surfaces. Inventory management may continue to show store price (current behavior) while base cost remains visible in product edit/details screens.

## Implementation Tasks (Concrete)

- [ ] Add a small helper for checkout price selection (optional but recommended for consistency)
  - Location option: `src/pages/CheckoutPage.tsx` local function
  - Better: reuse `getProductDisplayPrice` from `src/hooks/useMarkupSetting.ts` directly from checkout/cart/search components
- [ ] Update checkout totals
  - File: `src/pages/CheckoutPage.tsx` (`calculateTotals()`)
  - Replace base price read with markup-aware display price
  - Update missing-price counting per chosen behavior (A or B)
- [ ] Update checkout review modal item pricing
  - File: `src/pages/CheckoutPage.tsx` (review modal mapping uses `const price = item.product.fields.Price`)
- [ ] Update cart item UI
  - File: `src/components/cart/CartItem.tsx` (price badge)
- [ ] Update checkout “add to cart” listing/search surfaces to match cart pricing
  - File: `src/components/search/ProductBrowsePanel.tsx` (`ProductCard` uses `product.fields.Price`)
  - File: `src/components/search/ProductSearchDropdown.tsx` (`SearchResultItem` uses `product.fields.Price`)
  - File: `src/components/search/QuickAddGrid.tsx` (grid price uses `product.fields.Price`)
  - Ensure these screens show the same unit price as the cart for the same product

## Acceptance Criteria

- [ ] Given a product with `Price=5.12`, `Markup=70`, `Price 70%=9.98`, checkout/cart displays `€9.98` as unit price and totals with `9.98 * quantity`.
- [ ] The checkout “TOTAL” in the cart panel matches the sum of displayed per-item store prices.
- [ ] The review modal shows the same unit price and line totals as the cart list.
- [ ] Product browse/search cards used for adding to cart show the same price as the cart (no base/store mismatch within checkout mode).
- [ ] Missing tier price behavior is consistent and visible (warn or block), and is covered by a test.

## Testing Plan

### Automated (Preferred)

- [ ] Add/extend a Playwright test that:
  - Creates/mocks a product with base + tier prices and `Markup=70`
  - Adds it to cart (via search or browse)
  - Asserts cart unit price and total reflect tier price, not base
  - Candidate location: `tests/` (new spec like `tests/checkout-pricing.spec.ts`)

If mocking is easier than live data:

- Use existing mocks/factories:
  - `src/test/factories.ts` (has products with tier prices)
  - `src/test/mocks/api.ts` (maps tier fields)

### Manual Regression

- [ ] Desktop: add 1 product via search; verify unit price, total, and review modal line total match store price.
- [ ] Mobile: add via browse grid; verify cart list and bottom bar total (if shown) match.
- [ ] Edge: product missing `Price 70%` but has base `Price`:
  - Verify chosen behavior (warn or block) triggers correctly.

## Risks / Gotchas

- “Silent fallback” can hide data issues (tier price missing). Prefer explicit warning at minimum.
- Sorting by price in inventory uses base price (`src/hooks/useInventoryList.ts`). Not part of this fix, but it can confuse users if they expect sorting by store price.

## References

- Markup-aware pricing selector: `src/hooks/useMarkupSetting.ts`
- Checkout base-price usage: `src/pages/CheckoutPage.tsx`, `src/components/cart/CartItem.tsx`
- Inventory already uses markup-aware display: `src/components/inventory/InventoryTable.tsx`, `src/components/inventory/ProductListItem.tsx`
