# Observability and Error Surfacing

**Version**: 0.2.0 (draft)
**Status**: POST_MVP (DEFERRED)
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md) (POST_MVP)
**MVP Scope**: [mvp_scope_lean.md](./mvp_scope_lean.md)

**⚠️ DEFERRED TO POST-MVP**: Advanced observability infrastructure is not required for MVP. Basic console logging and browser DevTools are sufficient for debugging during validation with 2-3 testers. Implement comprehensive observability after confirming product-market fit.

## Objective
Improve visibility into API interactions, scanner behavior, and client errors to speed debugging and support production readiness.

## Scope
- Client logging/telemetry around Airtable proxy calls, scanner events, and React Query error boundaries.

## MVP Observability (Currently Sufficient)

**Implemented for validation phase:**
- ✅ Basic logger utility (`src/lib/logger.ts`) with debug/info/warn/error levels
- ✅ Console logging for API calls, stock mutations, product lookups
- ✅ Browser DevTools for network inspection
- ✅ React Query DevTools (if enabled in dev)
- ✅ Vercel deployment logs (stdout/stderr)

**Why this is enough for 2-3 testers:**
- You can ask testers "what happened?" and they can describe it
- Console logs + Vercel logs cover 95% of debugging needs
- Browser DevTools shows network errors
- Small user base means manual debugging is fast
- No need for error tracking service with <5 users

**Debugging workflow for MVP:**
1. Tester reports issue
2. Ask them to open DevTools console (F12)
3. Check console for errors and API call logs
4. Check Vercel logs if needed
5. Fix and redeploy (takes 2 minutes)

## Why Deferred to Post-MVP

**Launch-planner rationale:**
1. **Does it serve the core user loop?** No - observability is for developers, not users
2. **Can you validate the idea without it?** Yes - console.log is sufficient for small-scale testing
3. **Is there a simpler version?** Yes - basic logging (already implemented)

**The trap we're avoiding:** Setting up Sentry, DataDog, custom dashboards, etc. for 3 users who can just tell you what broke.

**When to implement comprehensive observability:**
- **Trigger**: More than 10 active users OR can't reproduce bugs from tester descriptions
- **Timeline**: Week 5-8 after validation
- **Estimated effort**: 2-3 days (Sentry integration + custom dashboards)
- **Tools to add**: Sentry, LogRocket, or similar error tracking service

## Changelog

### 0.2.0 (2025-12-05)
- Updated status to POST_MVP with deferral rationale
- Added MVP observability section documenting current logging
- Clarified that console logging is sufficient for validation phase

### 0.1.0 (2025-12-05)
- Initial draft outlining observability objectives, scope, and dependencies

## Requirements
- Structured logging for client-server interactions including correlation/trace IDs returned from the backend proxy.
- React Query error boundaries or global handlers that surface failures with consistent UI copy.
- Capture scanner errors (permission denied, camera init failure, decode errors) with context and timestamps.
- Optional analytics hook to track mutation success/failure rates and retry counts.
- Log redaction to avoid leaking sensitive payloads (e.g., API keys, PII).

## Implementation Notes
- Add a lightweight logging utility that can route to console in dev and a pluggable sink in production.
- Consider integrating with browser Performance/Resource timing for slow API call detection.
- Ensure logs include feature area and barcode/product identifiers where safe to do so.

## Recommended Tooling
- **Backend proxy logging**: [Pino](https://github.com/pinojs/pino) for structured JSON logs with request/trace IDs; ship via transport to Logtail/Datadog or a similar sink.
- **Frontend logging utility**: lightweight wrapper around `console` with log levels and trace ID support (e.g., [`loglevel`](https://github.com/pimterry/loglevel)) plus redaction for secrets.
- **Error reporting**: pluggable hook for Sentry/Bugsnag; default to `window.onunhandledrejection` and React error boundary logging to console in dev builds.
- **Metrics**: reuse proxy response timings for histogram-style counters; optional `navigator.sendBeacon` for fire-and-forget error beacons on unload.

## Acceptance Criteria
- Error events from scanner and API layers are recorded with correlation IDs and surfaced in UI.
- Centralized logging utility is used instead of ad-hoc `console.log` for new code paths.
- Observability is documented (what is logged, how to enable/disable, and where to view logs).
