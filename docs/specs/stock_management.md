# Feature: Stock Management

**Version**: 1.0.0
**Status**: COMPLETE (MVP)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: None (MVP complete)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

As a store employee
I want to adjust stock levels (IN/OUT)
So that I can track inventory flow and current availability

Scenario: Adding stock
    Given I am viewing the "Product Detail" page for "Apple"
    And the current stock is 10
    When I click the "Add Stock (+)" button
    Then a stock movement of type "IN" with quantity 1 should be recorded
    And the UI should optimistically update the stock to 11
    And the system should sync the movement to Airtable

Scenario: Removing stock
    Given I am viewing the "Product Detail" page for "Apple"
    And the current stock is 10
    When I click the "Remove Stock (-)" button
    Then a stock movement of type "OUT" with quantity -1 should be recorded
    And the UI should optimistically update the stock to 9
    And the system should sync the movement to Airtable

Scenario: Viewing stock history
    Given "Apple" has had multiple stock movements
    When I view the "Product Detail" page
    Then I should see the calculated total stock (Rollup)
    And I should see a list of recent stock movements (if implemented in UI)

## Implementation Status

**All scenarios are implemented and working:**
- ✅ Add stock (IN) with optimistic UI updates
- ✅ Remove stock (OUT) with optimistic UI updates
- ✅ View stock history (last 10 movements)
- ✅ Current stock display via Airtable rollup
- ✅ Adjustable quantity input
- ✅ Large quantity safety confirmation (50+ items)
- ✅ Error rollback on API failure

**Implementation notes:**
- Stock mutations: `src/components/product/ProductDetail.tsx` (handleStockChange)
- API layer: `src/lib/api.ts` (addStockMovement, getStockMovements)
- React Query integration: Optimistic updates with automatic rollback
- Quantity signing: Automatic conversion (OUT = negative, IN = positive)
- Safety threshold: Confirms quantities over 50 items

**Post-MVP enhancements (deferred):**
- Server-side validation of stock movements
- Backend proxy for Airtable security
- Advanced audit logging
- Bulk stock operations

## Changelog

### 1.0.0 (2025-12-05)
- Updated status to COMPLETE (MVP) - all critical scenarios implemented
- Removed dependencies on backend_proxy, validation_guardrails, operations_safety (post-MVP)
- Added implementation status section with file references
- Noted safety confirmation feature (50+ items)

### 0.1.0 (2025-12-05)
- Initial draft of stock management scenarios and dependencies
