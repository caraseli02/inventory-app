# Scanner and API Error Experience

**Version**: 0.1.0 (draft)
**Status**: PARTIAL
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [observability.md](./observability.md), [backend_proxy.md](./backend_proxy.md), [validation_guardrails.md](./validation_guardrails.md), [mvp_scope.md](./mvp_scope.md)

## Objective
Deliver resilient, user-friendly error handling for camera access, barcode scanning, network failures, and stock/product mutations.

## Scope
- Scanner component, scan page, and product detail/mutation flows.

## Requirements
- Explicit camera permission states: requesting, granted, denied (with recovery guidance and retry control).
- Inline errors for lookup/mutation failures; replace `alert` usage with non-blocking toasts/banners.
- Loading/empty/error states for product lookup and stock history; avoid silent failures.
- Retry affordances for transient API errors (React Query retries with backoff where appropriate).
- Telemetry hooks for scanner errors and API failures to aid debugging.

## Implementation Notes
- Surface camera-denied state with actionable steps (check browser permissions, open settings link if available).
- Use React Query error boundaries or per-query `onError` handlers to centralize messaging.
- Provide optimistic UI for stock mutations with rollback on failure and a clear error surface when rollback happens.
- Co-locate error message copy for consistency and localization readiness.

## Acceptance Criteria
- No use of `alert` in scanner or product mutation flows.
- Camera-denied state is visible and tested; manual entry remains available.
- Users see clear, context-specific errors for lookup and stock mutations with retry guidance.
- Telemetry/logging records scanner and API errors with correlation IDs or timestamps.

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft summarizing scanner error handling requirements and acceptance criteria.
