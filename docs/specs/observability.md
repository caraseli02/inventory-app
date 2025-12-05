# Observability and Error Surfacing

**Version**: 0.1.0 (draft)
**Status**: NOT_STARTED
**Owner**: TBD
**Last Updated**: 2025-12-05
**Dependencies**: [backend_proxy.md](./backend_proxy.md), [scanner_error_handling.md](./scanner_error_handling.md), [operations_safety.md](./operations_safety.md), [mvp_scope.md](./mvp_scope.md)

## Objective
Improve visibility into API interactions, scanner behavior, and client errors to speed debugging and support production readiness.

## Scope
- Client logging/telemetry around Airtable proxy calls, scanner events, and React Query error boundaries.

## Changelog

### 0.1.0 (2025-12-05)
- Initial draft outlining observability objectives, scope, and dependencies.

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
