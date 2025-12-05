# Feature: Product Management

**Version**: 0.1.0 (draft)
**Status**: PARTIAL
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md), [validation_guardrails.md](./validation_guardrails.md), [operations_safety.md](./operations_safety.md), [mvp_scope.md](./mvp_scope.md)

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

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft of product management scenarios and dependencies.
