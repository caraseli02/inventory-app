# FastAPI Invoice Security Guide

## Current Security Model

Production invoice extraction uses a server-side proxy:

`Client -> /api/extract-invoice -> FastAPI /extract`

Security properties:
- API key is server-only (`INVOICE_API_KEY`), not shipped to browser.
- Proxy validates Supabase session token before forwarding request.
- Browser never sends `X-API-Key`.

## Critical Rules

1. Do not use `VITE_INVOICE_API_KEY` in client env.
2. Keep `INVOICE_API_KEY` only in hosting server env variables.
3. Keep `INVOICE_PROXY_REQUIRE_AUTH=true` in production.
4. Reject unauthenticated proxy requests (`401`).

## Required Environment Variables

Server-side:

```bash
INVOICE_API_URL=https://your-fastapi-service.example.com
INVOICE_API_KEY=your-fastapi-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
INVOICE_PROXY_REQUIRE_AUTH=true
```

Client-side:

```bash
VITE_INVOICE_API_URL=http://localhost:8000   # optional dev fallback only
# VITE_INVOICE_PROXY_URL=/api/extract-invoice
```

## Validation Checklist

- `rg "VITE_INVOICE_API_KEY|VITE_INVOICE_API_REQUIRE_AUTH" src .env*` returns no active usage.
- Upload without Bearer token to `/api/extract-invoice` returns `401`.
- Signed-in upload succeeds and forwards to FastAPI.
- API key is not present in browser network requests.

## Threats Mitigated

- Client bundle key extraction.
- Unlimited abuse via copied browser API key.
- Direct anonymous access to extraction proxy (when auth required).

## Remaining Recommendations

1. Add rate limiting in proxy and/or FastAPI.
2. Log request metadata (without sensitive payloads).
3. Enforce strict file validation server-side (MIME + size + extension).
4. Consider per-user quotas for invoice extraction.

## Deprecated Configuration

Do not reintroduce:
- `VITE_INVOICE_API_KEY`
- `VITE_INVOICE_API_REQUIRE_AUTH`

These variables were removed to prevent client-side secret exposure.
