# Feature: Checkout Flow

**Version**: 0.1.0
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2025-12-06
**Dependencies**: [scanner.md], [stock_management.md]

As a store clerk
I want to scan multiple items and batch them in a cart
So that I can efficiently process customer purchases

## Cart Building

Scenario: Successfully scanning a product into cart
    Given I am on the checkout page
    When I scan a valid barcode
    Then the product is added to my cart
    And the quantity is set to 1
    And the scanner is re-enabled

Scenario: Scanning duplicate product increments quantity
    Given I have a product in my cart
    When I scan the same barcode again
    Then the quantity for that product is incremented
    And no duplicate entry is created
    And the scanner is re-enabled

Scenario: Gating scans during product lookup
    Given a product lookup is in progress
    When I attempt to scan another barcode
    Then the scan is blocked
    And a "Processing…" indicator is shown
    And the scanner input is disabled

Scenario: Re-enabling scanner after lookup completes
    Given a product lookup has completed (success or error)
    When I'm ready to scan the next item
    Then scanning is re-enabled
    And the "Processing…" state is cleared

Scenario: Manual entry respects the scan gate
    Given a product lookup is in progress
    When I attempt to manually enter a product
    Then submission is disabled
    And a "Processing…" state is shown

## Changelog

### 0.1.0 (2025-12-06)
- Initial spec documenting cart building and scan gating behavior
- Implemented `isPendingLookup` state to prevent duplicate scans
- Added "Processing…" UI feedback during lookups
