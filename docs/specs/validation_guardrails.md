# Input Validation and Resilience Guardrails

**Version**: 0.2.0 (draft)
**Status**: POST_MVP (DEFERRED)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md) (also POST_MVP)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

**⚠️ DEFERRED TO POST-MVP**: Comprehensive validation is not required for MVP. Basic HTML5 validation and simple checks are sufficient for testing with trusted users. Implement comprehensive validation after confirming product-market fit.

## Objective
Harden user inputs and data integrity for barcode entry, pricing, stock adjustments, and expiry handling.

## Scope
- Manual barcode entry, product creation form, and stock adjustment inputs.

## MVP Validation (Currently Implemented)

**Sufficient for validation phase:**
- ✅ HTML5 input validation (`type="number"`, `min="1"`)
- ✅ Client-side checks for non-negative quantities (ProductDetail.tsx:66-70)
- ✅ Large quantity confirmation (50+ items threshold)
- ✅ Basic type checking via TypeScript
- ✅ Airtable's built-in data integrity

**Why this is enough:**
- Trusted testers (2-3 people) won't attempt SQL injection
- Airtable handles malicious formula content automatically
- HTML5 validation catches 95% of innocent mistakes
- TypeScript prevents type-related bugs
- The goal is to validate the concept, not harden against attacks

## Why Deferred to Post-MVP

**Launch-planner rationale:**
1. **Does it serve the core user loop?** No - validation doesn't help users track inventory faster
2. **Can you validate the idea without it?** Yes - trusted testers won't try to break the app
3. **Is there a simpler version?** Yes - HTML5 + basic checks (already implemented)

**The trap we're avoiding:** Spending days building formula injection protection for 3 trusted users who won't attack their own inventory app.

**When to implement comprehensive validation:**
- **Trigger**: Planning to share beyond trusted testers OR evidence of data integrity issues
- **Timeline**: Week 3-4 after validation (alongside backend proxy)
- **Estimated effort**: 1-2 days (validation helpers + tests)

## Changelog

### 0.2.0 (2025-12-05)
- Updated status to POST_MVP with deferral rationale
- Added MVP validation section documenting current implementation
- Clarified that basic HTML5 + Airtable protections are sufficient for validation

### 0.1.0 (2025-12-05)
- Initial draft outlining validation guardrail objectives, scope, and dependencies

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
