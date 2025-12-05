# MVP Scope and Prioritization

**Version**: 0.1.0 (draft)
**Status**: IN_PROGRESS
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: None

## Objective
Clarify which open specs are mandatory to ship a safe, testable MVP versus which can be deferred to post-MVP hardening.

## MVP-Critical (must ship)
- **Backend proxy for Airtable** – Prevents credential leakage and enables server-side validation/sanitization for all Airtable calls.
- **Validation guardrails** – Enforce barcode formats, non-negative stock/price, and basic expiry/date checks to avoid corrupting inventory data.
- **Scanner/API error handling** – Provide user-visible errors (camera permissions, lookup failures, mutation failures) so core flows are recoverable.
- **Operations & safety basics** – Document environment variables, secret handling, and rollback expectations so deployments are safe.

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft defining MVP scope, priorities, and critical dependencies.

## Nice-to-have for MVP (scope if time allows)
- **Docs home/onboarding polish** – Helpful to reduce friction, but the MVP can launch with a lean README + links to the critical specs above.
- **Observability hooks** – Lightweight logging/monitoring is useful but can be stubbed (client-side logs + simple server logs) and expanded post-MVP.
- **PWA/offline behavior** – Optional for first release; prioritize online correctness before adding caching/offline flows.

## Post-MVP hardening
- Expand observability to include error budgets, tracing, and dashboards.
- Add richer authorization beyond the initial shared secret/token for the backend proxy.
- Invest in offline/PWA resilience (cache versioning, retry queues) once online flows are stable.

## Acceptance
- The MVP plan clearly communicates that only the "MVP-Critical" items block launch; other specs are scheduled for later iterations.
- README/Docs Home (or equivalent entry point) links to this prioritization so contributors know what to implement first.
