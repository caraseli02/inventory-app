# ADR-0001: Airtable Access via Backend Proxy

- **Status**: Accepted
- **Date**: 2025-12-05
- **Deciders**: Product Engineering (Backend/Frontend)

## Context
The frontend currently accesses Airtable directly, exposing API keys and limiting our ability to enforce validation, rate limits, and observability. We need a secure, extensible path that supports future auth requirements and structured logging.

## Decision
Route all Airtable traffic through a backend proxy (serverless function or lightweight Node service). The proxy stores Airtable credentials server-side, validates inputs, attaches correlation IDs, and enforces an auth token for write operations.

## Consequences
- **Positive**: Secrets removed from client bundles; consistent validation and logging; easier to evolve auth/roles; centralized error handling.
- **Negative**: Additional deployment surface to operate and monitor; introduces latency and availability dependency.
- **Follow-ups**: Implement proxy per [backend_proxy.md](../specs/backend_proxy.md); update client API layer to use proxy endpoints; add smoke tests against proxy routes.

## Alternatives Considered
- **Direct client Airtable access**: Rejected due to secret exposure and lack of input sanitization.
- **Third-party middleware SaaS**: Rejected to avoid vendor lock-in and latency; proxy is lightweight enough to own.
