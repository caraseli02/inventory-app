# Scanner and API Error Experience

**Version**: 1.0.0 (MVP)
**Status**: COMPLETE (MVP)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: None (MVP complete)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

**Note**: Advanced error handling features (toasts, telemetry, sophisticated retry) are deferred to post-MVP. Basic error handling with alerts is sufficient for validation.

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

## MVP Implementation Status

**Implemented for MVP (sufficient for validation):**
- ✅ Camera permission error handling (html5-qrcode provides default messages)
- ✅ Network failure error messages (try/catch with alerts)
- ✅ Optimistic UI with automatic rollback on API failure
- ✅ Error messages for stock mutations
- ✅ Basic React Query error handling
- ✅ Console logging for debugging

**Implementation notes:**
- Camera errors: Handled by html5-qrcode library
- API errors: Try/catch blocks in `src/lib/api.ts` with `logger.error()`
- Mutation errors: React Query `onError` handlers in `src/components/product/ProductDetail.tsx`
- User feedback: Browser `alert()` for critical errors (simple but functional)

## Post-MVP Enhancements (Deferred)

**To implement after validation:**
- ❌ Replace `alert()` with toast notifications or inline banners
- ❌ Advanced telemetry with correlation IDs and timestamps
- ❌ Sophisticated retry logic with exponential backoff
- ❌ Manual barcode entry fallback
- ❌ Error tracking service integration (Sentry, etc.)
- ❌ Offline error queuing

**Rationale**: Basic error handling is sufficient to validate if users want the product. Polish can come after confirmation that people actually use it.

## Acceptance Criteria

### MVP (COMPLETE)
- ✅ Camera-denied state prevents scanner from starting
- ✅ Users see error messages for lookup and stock mutations
- ✅ API failures trigger user-visible errors
- ✅ Console logging available for debugging

### Post-MVP (DEFERRED)
- ⏸️ No use of `alert` in production (toasts instead)
- ⏸️ Manual entry fallback for camera failures
- ⏸️ Telemetry/logging with correlation IDs
- ⏸️ Sophisticated retry guidance for transient errors

## Changelog

### 1.0.0 (2025-12-05)
- Updated status to COMPLETE (MVP)
- Clarified MVP vs post-MVP error handling requirements
- Removed dependencies on observability, backend_proxy, validation_guardrails (post-MVP)
- Noted that alerts are acceptable for MVP validation phase

### 0.1.0 (2025-12-05)
- Initial draft summarizing scanner error handling requirements and acceptance criteria
