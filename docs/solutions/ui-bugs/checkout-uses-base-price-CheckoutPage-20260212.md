---
module: CheckoutPage
date: 2026-02-12
problem_type: ui_bug
component: page_component
symptoms:
  - "Checkout/cart shows base cost (fields.Price) instead of store/tier price (fields['Price 70%'])"
  - "Cart TOTAL is calculated from base cost, creating incorrect payment totals"
  - "Mismatch between inventory listing (store price) and checkout (base price)"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [checkout, cart, pricing, markup, store-price, parity]
related_github_issue: null
commit: null
---

# Problem Description

Checkout mode was using the product base cost (`fields.Price`) as the unit price. Inventory/listing views were already using the markup-tier store price (`fields.Markup` + `fields['Price 50%|70%|100%']`). This caused checkout to show and total the wrong price.

# Symptoms

- Checkout browse cards / cart line items show `€5.12` even when the store price is `€9.98` for the active tier.
- Cart TOTAL is computed using base cost, undercharging in checkout UI.
- Product edit dialog shows base cost and store-tier math, but checkout ignores it.

# Root Cause Analysis

Multiple checkout surfaces read `fields.Price` directly instead of using the existing markup-aware selector helper.

Example (checkout totals):

```tsx
// ❌ BEFORE (base cost)
const price = item.product.fields.Price;
if (price != null) result.total += price * item.quantity;
```

Example (cart line item price badge):

```tsx
// ❌ BEFORE (base cost)
const price = item.product.fields.Price;
```

# Solution

Use `getProductDisplayPrice(product.fields)` consistently in checkout mode for:
- browse/search cards used to add products
- cart line items
- cart totals
- review modal (unit price + line totals)

```tsx
// ✅ AFTER (store/tier price based on Markup, fallback to base)
const price = getProductDisplayPrice(item.product.fields);
```

Additionally, detect when the active tier price is missing and the UI is falling back to base cost, and show an explicit warning in the review modal.

Decision recorded:
- Scan/Manage Stock (ScanPage) does not need base cost display; store/tier price is acceptable in its search dropdown as well.

# Files Changed

- `src/pages/CheckoutPage.tsx`
- `src/components/cart/CartItem.tsx`
- `src/components/search/ProductBrowsePanel.tsx`
- `src/components/search/ProductSearchDropdown.tsx`
- `src/components/search/QuickAddGrid.tsx`

# Verification

- Automated: unit test added to assert cart item shows tier price (not base):
  - `tests/unit/components/cart/CartItem.test.tsx`
- Manual/UI verification (agent-browser screenshots):
  - `docs/reports/2026-02-12-checkout-price-parity-report.md`
  - `docs/reports/2026-02-12-test-browser-checkout-price-parity.md`

# Prevention

- [x] Reuse a single pricing selector (`getProductDisplayPrice`) instead of reading `fields.Price` directly in checkout UI.
- [x] Add a focused unit test locking markup-tier behavior in cart rendering.
- [ ] Add an E2E assertion (Playwright) that checkout totals match tier/store price for a known product.

