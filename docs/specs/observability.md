# Observability and Error Surfacing

## Objective
Improve visibility into API interactions, scanner behavior, and client errors to speed debugging and support production readiness.

## Scope
- Client logging/telemetry around Airtable proxy calls, scanner events, and React Query error boundaries.

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

## Acceptance Criteria
- Error events from scanner and API layers are recorded with correlation IDs and surfaced in UI.
- Centralized logging utility is used instead of ad-hoc `console.log` for new code paths.
- Observability is documented (what is logged, how to enable/disable, and where to view logs).
