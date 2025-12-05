# Feature: Product Management

**Version**: 1.0.0
**Status**: COMPLETE (MVP)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: None (MVP complete)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

As a store employee
I want to manage product details in the system
So that the inventory is accurate and searchable

Scenario: Lookup existing product
    Given a product with barcode "123456789" exists in Airtable
    When I scan or lookup barcode "123456789"
    Then the system should retrieve the product details
    And I should be taken to the "Product Detail" page
    And I should see the Name, Price, and calculated Stock

Scenario: Create new product
    Given a product with barcode "987654321" does NOT exist in Airtable
    When I scan or lookup barcode "987654321"
    Then the system should detect the product is missing
    And I should be taken to the "Create Product" form
    And the barcode field should be pre-filled with "987654321"

Scenario: AI Auto-Fill and Image Fetching
    Given I scan a barcode that exists in OpenFoodFacts (e.g. "5449000000996")
    When the "Create Product" form loads
    Then the "Product Name" should automatically populate (e.g. "Coca-Cola")
    And the "Category" should automatically populate (e.g. "Beverages")
    And a product image preview should appear if available
    And I should see a visual indicator that AI is fetching data

Scenario: Successfully creating a product
    Given I am on the "Create Product" form for barcode "987654321"
    When I enter "New Chips" as Name and "2.99" as Price
    And I select "Snacks" as Category
    And I click "Create & Stock"
    Then the product should be saved to Airtable
    And an initial stock 'IN' movement should be created (if specified)
    And I should be redirected to the "Product Detail" page for the new product

## Implementation Status

**All scenarios are implemented and working:**
- ✅ Lookup existing products by barcode from Airtable
- ✅ Create new products with form validation
- ✅ AI auto-fill from OpenFoodFacts (name, category, image)
- ✅ Visual loading indicator for AI data fetching
- ✅ Image preview in create form
- ✅ Initial stock movement creation on product creation
- ✅ Redirect to Product Detail page after creation

**Implementation notes:**
- API layer: `src/lib/api.ts` (getProductByBarcode, createProduct)
- Create form: `src/components/product/CreateProductForm.tsx`
- Detail view: `src/components/product/ProductDetail.tsx`
- Product lookup hook: `src/hooks/useProductLookup.ts`
- AI integration: `src/lib/ai/openFoodFacts.ts`

**Post-MVP enhancements (deferred):**
- Server-side validation (basic HTML5 validation sufficient for MVP)
- Backend proxy for Airtable (client-side OK for validation phase)
- Advanced error recovery (basic error messages sufficient)

## Changelog

### 1.0.0 (2025-12-05)
- Updated status to COMPLETE (MVP) - all critical scenarios implemented
- Removed dependencies on backend_proxy, validation_guardrails, operations_safety (post-MVP)
- Added implementation status section with file references

### 0.1.0 (2025-12-05)
- Initial draft of product management scenarios and dependencies
