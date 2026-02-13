---
title: "Browser Test Report: Checkout Price Parity"
date: 2026-02-12
tool: agent-browser
mode: headless
---

# Browser Test Report: Checkout Price Parity (2026-02-12)

## Scope

Files changed in working tree:
- `src/pages/CheckoutPage.tsx`
- `src/components/cart/CartItem.tsx`
- `src/components/search/ProductBrowsePanel.tsx`
- `src/components/search/ProductSearchDropdown.tsx`
- `src/components/search/QuickAddGrid.tsx`
- `src/test/setup.ts`

Tested flows in a real browser (headless Chromium via `agent-browser`):
- Home -> Checkout mode -> add product -> verify cart + total -> open review modal
- Home -> Scanner/Manage Stock -> search dropdown renders results

## Results

### Checkout mode pricing parity

Observed product card in Checkout browse panel shows tier/store price (example: `€9.98`).
After adding to cart:
- cart line item shows the same `€9.98`
- TOTAL matches that price
- review modal shows `quantity × €9.98` and line totals computed from tier price

Screenshots:
- Home: `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/01-home.png`
- Checkout initial (browse cards show store price): `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/02-checkout-initial.png`
- After add-to-cart (cart + total show store price): `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/03-after-add.png`
- Review modal (unit price + totals): `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/04-review-modal.png`
- Review modal (extra capture): `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/05-review-modal-zoom.png`
- Back to cart: `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/06-back-to-cart.png`

### Scan/Manage Stock search dropdown

Verified ScanPage loads and search dropdown can be opened and populated.
Note: the dropdown now shows markup-aware display prices, which may or may not be desired for ScanPage (see todo `020`).

Screenshots:
- Scan page: `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/07-scan-page.png`
- Scan search dropdown: `docs/reports/2026-02-12-test-browser-checkout-price-parity/assets/08-scan-search-dropdown.png`

## Issues Found

No crashes or obvious UI errors encountered during the tested flows.

Follow-ups tracked:
- `todos/020-pending-p2-confirm-price-mode-in-scan-page-search.md`
- `todos/021-complete-p3-add-locale-key-for-checkout-fallback-warning.md`
- `todos/022-pending-p3-ignore-generated-git-hooks-directory.md`
