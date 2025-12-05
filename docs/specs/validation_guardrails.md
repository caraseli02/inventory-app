# Input Validation and Resilience Guardrails

**Version**: 0.1.0 (draft)
**Status**: NOT_STARTED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md), [operations_safety.md](./operations_safety.md), [mvp_scope.md](./mvp_scope.md)

## Objective
Harden user inputs and data integrity for barcode entry, pricing, stock adjustments, and expiry handling.

## Scope
- Manual barcode entry, product creation form, and stock adjustment inputs.

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft outlining validation guardrail objectives, scope, and dependencies.

## Requirements
- Barcode validation: enforce UPC/EAN formats (length and character sets), reject malicious formula content, and normalize whitespace.
- Pricing: non-negative numeric validation with currency formatting; optional upper bounds to catch obvious mistakes.
- Stock adjustments: integer-only deltas; reject negative resulting inventory if business rules require non-negative stock.
- Expiry and dates: validate date format, reject past dates when inappropriate, and display timezone assumptions.
- Error copy is specific and inline; fields show validation state before submit when possible.

## Barcode Validation Examples
- **Accepted patterns**: 8–14 digit numeric strings (EAN/UPC style), e.g., `01234567`, `5012345678900`.
- **Rejected patterns**:
  - Strings containing letters or symbols: `ABC12345`, `1234-5678` (display: "Barcode must be numbers only").
  - SQL/formula injection attempts: `{table}=1`, `DROP TABLE products` (display: "Invalid barcode format").
  - Overlength values (>14 digits) or underlength (<8 digits) should block submission and skip API calls.
- **Edge cases to cover in tests**: leading zeros retained, pasted values with whitespace trimmed, and repeated rapid scans debounced to avoid duplicate submissions.

## Implementation Notes
- Centralize validation helpers for reuse across forms and backend proxy.
- Normalize input on blur (trim, uppercase as needed) before validation to reduce false errors.
- Pair client-side validation with server-side validation in the backend proxy for defense in depth.
- Add form-level disable state during submission to prevent duplicate requests.

## Acceptance Criteria
- Manual barcode entry rejects malformed or unsafe values with clear messages and does not hit the API when invalid.
- Create Product form blocks negative price/stock and invalid expiry dates with inline feedback.
- Stock mutation buttons prevent invalid deltas and surface validation errors without API calls.
- Shared validation utilities have unit test coverage for edge cases.
