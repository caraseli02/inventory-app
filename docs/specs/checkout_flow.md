# Feature: Checkout Flow

**Version**: 0.1.0
**Status**: IMPLEMENTED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: Scanner, Stock Movements API

As a store employee
I want to check customers out by scanning items and creating OUT stock movements
So that inventory levels stay accurate after sales

Scenario: Checkout multiple items with per-line processing
    Given I have scanned multiple products into the checkout cart
    When I confirm checkout
    Then each cart line should be processed sequentially as an OUT stock movement
    And the UI should display a per-line status showing processing, success, or failure
    And failed lines should remain in the cart so I can retry or adjust quantity
    And a summary of successes and failures should be shown inline on the checkout page

## Implementation Status

**Scenario coverage**:
- ✅ Checkout multiple items with per-line processing and inline status display

**Status display pattern**:
- Each cart item carries a `status` and `statusMessage` that reflect its last checkout attempt.
- During checkout, items move through `processing → success/failed` states and the card shows the current state inline beneath the product price.
- A footer summary reports total successes and failures; failed lines stay in the cart for quantity adjustments and retries without using global alerts.
- Successful lines remain visible with a success badge while pending totals and checkout confirmation only consider lines that still need to be processed.

**Implementation notes**:
- UI logic: `src/pages/CheckoutPage.tsx` (`handleCheckout`, inline status badges, footer summary)
- API: `addStockMovement(productId, quantity, 'OUT')` for per-line movements

## Changelog

### 0.1.0 (2025-12-05)
- Added inline status display pattern and marked checkout scenario implemented
