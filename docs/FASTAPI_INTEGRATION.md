# FastAPI Integration Guide

Guide for invoice extraction using a secure server-side proxy.

## Overview

Production flow:
1. Browser uploads PDF to `/api/extract-invoice`
2. Vercel function validates Supabase session
3. Vercel function forwards file to FastAPI `/extract` with server-side `INVOICE_API_KEY`
4. FastAPI returns structured invoice JSON

Local dev fallback:
- If proxy is unavailable, browser can call `VITE_INVOICE_API_URL/extract` in development only.

## API Contract

### App-facing endpoint

`POST /api/extract-invoice`

Request:
- `Content-Type: multipart/form-data`
- field `file` (PDF)
- header `Authorization: Bearer <supabase-access-token>` (required by default)

Response:
- Pass-through from FastAPI `/extract`

Common errors:
- `401` missing/invalid session token
- `400` invalid multipart request / invalid PDF
- `413` file too large (>10MB)
- `5xx` proxy or upstream failure

### FastAPI endpoint (upstream)

`POST {INVOICE_API_URL}/extract`

Request from proxy:
- `Content-Type: multipart/form-data`
- `X-API-Key: <INVOICE_API_KEY>` (server-side)

## Environment Configuration

### Browser (`.env`)

```bash
# Optional dev fallback (used only in DEV when proxy URL not used)
VITE_INVOICE_API_URL=http://localhost:8000

# Optional; defaults to /api/extract-invoice
# VITE_INVOICE_PROXY_URL=/api/extract-invoice
```

### Server (Vercel/hosting env)

```bash
# Required
INVOICE_API_URL=https://your-fastapi-service.example.com
INVOICE_API_KEY=your-fastapi-key

# Supabase auth validation inputs (required when auth enabled)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
# or SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Optional (default: true)
INVOICE_PROXY_REQUIRE_AUTH=true
```

## Local Development

1. Run FastAPI locally (`http://localhost:8000`).
2. Run app (`pnpm dev`).
3. Prefer proxy route if available.
4. If proxy not running locally, DEV fallback uses `VITE_INVOICE_API_URL`.

## Production Checklist

- `INVOICE_API_KEY` is set only as server env var.
- No `VITE_INVOICE_API_KEY` in any client env/config.
- `/api/extract-invoice` returns `401` without Bearer token.
- Invoice upload works for signed-in users.

## Migration Notes

Removed from client-side setup:
- `VITE_INVOICE_API_KEY`
- `VITE_INVOICE_API_REQUIRE_AUTH`

These are intentionally deprecated for security reasons.
