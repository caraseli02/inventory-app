# MVP Scope and Prioritization

**Version**: 0.1.0 (draft)
**Status**: SUPERSEDED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: None

**⚠️ THIS SPEC HAS BEEN SUPERSEDED**

This document represented the original MVP scope that was blocking launch on infrastructure concerns. It has been replaced by:

**Active MVP Scope:** [mvp_scope_lean.md](./mvp_scope_lean.md)

**Why it was superseded:**
- Original scope blocked launch on backend proxy, comprehensive validation, and extensive documentation
- Launch-planner analysis revealed these are infrastructure concerns, not validation requirements
- All core features are already complete and working
- New lean scope focuses on shipping by Friday and validating with real users

**Refer to mvp_scope_lean.md for current priorities and launch plan.**

---

# Original Content (Historical Reference)

## Objective
Clarify which open specs are mandatory to ship a safe, testable MVP versus which can be deferred to post-MVP hardening.

## MVP-Critical (must ship)
- **Backend proxy for Airtable** – Prevents credential leakage and enables server-side validation/sanitization for all Airtable calls.
- **Validation guardrails** – Enforce barcode formats, non-negative stock/price, and basic expiry/date checks to avoid corrupting inventory data.
- **Scanner/API error handling** – Provide user-visible errors (camera permissions, lookup failures, mutation failures) so core flows are recoverable.
- **Operations & safety basics** – Document environment variables, secret handling, and rollback expectations so deployments are safe.

## Changelog

### 0.1.0 (2025-12-05) - SUPERSEDED
- Status changed to SUPERSEDED - replaced by mvp_scope_lean.md
- Original scope blocked launch on infrastructure (backend proxy, validation, observability)
- Launch-planner analysis revealed core features are complete and ready to ship
- Document retained for historical reference

### 0.1.0 (2025-12-05) - Original
- Initial draft defining MVP scope, priorities, and critical dependencies

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
