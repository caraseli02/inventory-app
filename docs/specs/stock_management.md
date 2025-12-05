# Feature: Stock Management

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
