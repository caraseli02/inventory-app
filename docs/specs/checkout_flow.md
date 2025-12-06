# Feature: Checkout Flow

**Version**: 0.2.0
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2025-12-06
**Dependencies**: [scanner.md], [stock_management.md]

As a store clerk
I want to scan multiple items, batch them in a cart, and process checkout with per-line status tracking
So that I can efficiently process customer purchases and handle failures gracefully

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

## Checkout Processing

Scenario: Checkout multiple items with per-line processing
    Given I have scanned multiple products into the checkout cart
    When I confirm checkout
    Then each cart line should be processed sequentially as an OUT stock movement
    And the UI should display a per-line status showing processing, success, or failure
    And failed lines should remain in the cart so I can retry or adjust quantity
    And a summary of successes and failures should be shown inline on the checkout page

## Implementation Status

**Cart building**: ✅ Implemented
- Scanner gating with `isPendingLookup` state prevents duplicate scans
- "Processing…" UI feedback during product lookups
- Cart increment logic for duplicate scans

**Checkout processing**: ✅ Implemented
- Per-line status tracking (processing → success/failed)
- Sequential stock movement creation
- Inline status messages beneath product entries
- Summary footer showing successes/failures
- Failed items remain in cart for retry/adjustment

## Changelog

### 0.2.0 (2025-12-06)
- Merged cart building and checkout processing scenarios
- Combined scan gating implementation with per-line status tracking

### 0.1.0 (2025-12-05)
- Initial draft with checkout scenario and implementation notes
