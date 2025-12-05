# Feature: Barcode Scanning

As a store employee
I want to scan barcodes on grocery items
So that I can quickly identify products and manage stock without typing

Scenario: Successfully scanning a product
    Given I am on the "Scan" page
    And the camera permissions are granted
    When I point the camera at a valid EAN-13 or UPC barcode
    Then the scanner should detect the barcode
    And the scanning should verify the barcode format
    And I should be redirected to the Product Detail or Create Product flow for that barcode

Scenario: Camera permission denied
    Given I did not grant camera permissions
    When I attempt to visit the "Scan" page
    Then I should see a "Camera permission required" error message
    And the scanner should not start

Scenario: Manual entry fallback
    Given I am on the "Scan" page
    When I cannot scan a barcode
    Then I should be able to manually enter the barcode (if implemented)
