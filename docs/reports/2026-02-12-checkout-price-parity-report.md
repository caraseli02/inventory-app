---
title: "Checkout vs Listing Price Parity Verification"
date: 2026-02-12
scope: checkout-price-source
---

# Checkout vs Listing Price Parity Verification (2026-02-12)

## Summary

Verified in the running app that Checkout mode now uses the **markup-tier store price** (not base cost) consistently across:

- product browse cards (left panel)
- cart line items (right panel)
- cart total
- review modal

Validated using product: `0.5L DIVIN 5 ANI BARDAR SILVER`.

## Evidence (Screenshots)

### 1) Checkout mode initial view (browse cards show store price)

- Expectation: product card should show store price (e.g., `€9.98`) for the active markup tier.
- Result: `0.5L DIVIN 5 ANI BARDAR SILVER` card displays `€9.98`.

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/01-checkout-initial.png`

### 2) After adding the product to cart (cart line item + total use store price)

- Expectation: cart line item and TOTAL should reflect store price.
- Result: cart shows the product at `€9.98` and TOTAL matches.

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/02-after-add-to-cart.png`

### 3) Review modal (unit price + line totals use store price)

- Expectation: review modal shows `quantity × €9.98` and line total computed from store price.
- Result: review modal reflects the same store price used in cart.

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/03-review-modal.png`

### 4) Back to cart (post-modal consistency)

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/04-back-to-cart.png`

### 5) Inventory list view (listing still works)

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/05-inventory-list.png`

### 6) Inventory filtered to the product

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/06-inventory-filtered.png`

### 7) Product details

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/07-product-detail.png`

### 8) Product edit dialog pricing section (base vs markup tier context)

- Observation: pricing section shows base cost (`€5.12 current base`) and markup tier context (`70%`).
- This matches the expected model: base cost stays as `Price`, store price is tier-derived.

Screenshot: `docs/reports/2026-02-12-checkout-price-parity/assets/08-product-edit-pricing.png`

## Notes

- Checkout browse/search surfaces and cart now display the same price source (markup-tier store price), eliminating the mismatch seen previously.
- If a product lacks the active tier price (e.g., missing `Price 70%`), checkout will fall back to base cost and display a warning.
