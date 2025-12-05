# Backend Proxy for Airtable Security

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
