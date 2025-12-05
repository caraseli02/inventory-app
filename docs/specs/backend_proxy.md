# Backend Proxy for Airtable Security

**Version**: 0.1.0 (draft)
**Status**: POST_MVP (DEFERRED)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [validation_guardrails.md](./validation_guardrails.md), [operations_safety.md](./operations_safety.md)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

**⚠️ DEFERRED TO POST-MVP**: This feature is not required for validation. Client-side Airtable integration is acceptable for testing with 2-3 trusted users. Implement this only after confirming that users actually want and use the product.

## Objective
Move Airtable authentication and query logic from the browser to a trusted backend proxy to eliminate secret exposure, add authorization, and sanitize input before hitting Airtable.

## Scope
- Applies to all inventory CRUD operations currently implemented in `src/lib/api.ts` and any future Airtable access.

## Requirements
- Backend endpoint(s) handle read/write for products, stock movements, and product creation.
- Airtable API key and base/table identifiers are stored server-side only (env vars); never shipped to the client bundle.
- Input validation and sanitization for barcode, product data, and stock deltas before constructing Airtable formulas or payloads.
- Role-based authorization surface (at minimum a single protected secret/token gate to start; extensible to per-user roles).
- Centralized error handling that returns structured errors consumable by the React Query layer.

## Implementation Notes
- Recommended minimal approach: serverless functions (e.g., Vercel/Netlify) or an Express handler colocated with Vite.
- Wrap Airtable access in server-side helpers; keep table names/constants centralized.
- Provide an authenticated route for stock mutations and product creation; consider rate limiting on mutation routes.
- Standardize response shape: `{ data, error, traceId }` for consistent client handling.
- Add unit tests for sanitization helpers and integration smoke tests for each route.

## Acceptance Criteria
- No Airtable secret or base ID appears in the client build artifacts.
- All frontend Airtable calls are replaced with calls to the backend proxy.
- Barcode lookup path rejects malformed/injected formulas and logs the attempt server-side.
- Documentation updated with environment variables and API surface for the proxy.

## Why Deferred to Post-MVP

**Launch-planner rationale:**
1. **Does it serve the core user loop?** No - scanning and stocking work fine with client-side Airtable
2. **Can you validate the idea without it?** Yes - with 2-3 testers, client-side credentials are acceptable
3. **Is there a simpler version?** Yes - use Vercel password protection and only share with trusted testers

**The trap we're avoiding:** Building enterprise security infrastructure for a product with zero validated users.

**MVP approach:**
- Deploy with client-side Airtable (current implementation)
- Use Vercel's password protection feature
- Share only with 2-3 trusted testers
- Monitor usage for 1 week

**When to implement this:**
- **Trigger**: At least 1 user uses the app for 3+ consecutive days
- **Timeline**: Week 2-3 after validation
- **Estimated effort**: 2-3 days (serverless functions + migration)

## Current MVP Mitigation

**Security measures for MVP validation:**
1. ✅ `.env` files in `.gitignore` - credentials never committed
2. ✅ Deploy to Vercel with password protection
3. ✅ Share URL only with trusted testers (max 5 people)
4. ✅ Monitor Airtable API usage for unexpected activity
5. ✅ Rotate Airtable token after validation period if needed

**Acceptable risks:**
- Airtable credentials visible in browser DevTools → Acceptable for closed testing
- No user authentication → Acceptable when sharing with known individuals
- No rate limiting → Acceptable with <5 users

**Non-negotiable:**
- Never share the URL publicly without implementing this proxy
- Never use production customer data without this proxy
- Rotate credentials if URL leaks

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft with objectives, scope, and acceptance criteria
- Updated status to POST_MVP with clear deferral rationale
- Added MVP mitigation section for validation phase security
