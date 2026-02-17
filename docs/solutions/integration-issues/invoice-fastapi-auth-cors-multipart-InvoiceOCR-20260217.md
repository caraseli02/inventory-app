---
module: InvoiceOCR
date: 2026-02-17
problem_type: integration_issue
component: api_client
symptoms:
  - "Browser request to http://localhost:8000/extract blocked by CORS preflight from localhost:5173/5174"
  - "Invoice upload failed with 'Authentication required. Please sign in again and retry invoice upload.'"
  - "FastAPI returned 'Missing boundary in multipart.' for /extract"
root_cause: wrong_api_usage
resolution_type: code_fix
severity: high
tags: [invoice-ocr, fastapi, cors, multipart, auth-token, vite-proxy]
related_github_issue: null
commit: null
---

# Problem Description

Invoice import via FastAPI `/extract` regressed in local development after architecture changes from proxy-first to direct API calls. The flow failed at multiple boundaries: browser CORS, missing/expired auth token, and malformed multipart headers.

# Symptoms

- Console error: `Access to XMLHttpRequest ... has been blocked by CORS policy`.
- UI error: `Extraction failed` and `Authentication required. Please sign in again and retry invoice upload.`
- API error: `{"detail":"Missing boundary in multipart."}`.
- Manual curl checks showed:
  - `401 Missing bearer token` without auth header.
  - `401 Invalid or expired token` with stale token.

# Root Cause Analysis

Three integration mistakes stacked:

```ts
// ❌ BEFORE - Direct dev call triggers cross-origin preflight
const extractUrl = 'http://localhost:8000/extract';

// ❌ BEFORE - Multipart Content-Type was forced manually
headers['Content-Type'] = 'multipart/form-data';

// ❌ BEFORE - Token lookup depended only on supabase.auth.getSession()
// and failed when stale/malformed cookie/local token state existed.
```

1. Direct browser calls to `localhost:8000` depended on backend CORS correctness.
2. Setting multipart `Content-Type` manually removed boundary handling.
3. Token resolution was brittle for expired/malformed persisted auth state.

# Solution

Use same-origin dev proxy, robust token resolution, and browser-managed multipart headers.

```ts
// ✅ AFTER - Dev same-origin proxy path
const extractUrl = useDevProxy ? '/extract' : `${apiUrl}/extract`;

// ✅ AFTER - No manual multipart Content-Type for FormData/XHR
const headers: Record<string, string> = {};

// ✅ AFTER - Resolve token from session/localStorage/cookie,
// reject expired JWTs, then fallback to signInAnonymously()
const accessToken = await resolveSupabaseAccessToken();
headers.Authorization = `Bearer ${accessToken}`;
```

Applied changes:

1. Added Vite dev proxy for `/extract` and `/invoice` routes.
2. Switched invoice clients to same-origin endpoints in dev when API URL is localhost.
3. Introduced `resolveSupabaseAccessToken()`:
   - checks active Supabase session.
   - checks persisted Supabase auth token in local storage.
   - checks cookie token (`sb-*-auth-token`) with safe decode.
   - validates JWT `exp` before use.
   - falls back to anonymous Supabase sign-in when needed.
4. Removed manual multipart `Content-Type` from invoice upload headers.
5. Added regression tests for upload header correctness and end-to-end dialog flow behavior.

# Files Changed

- `vite.config.ts`
- `src/lib/invoiceOCR.ts`
- `src/lib/invoiceImportApi.ts`
- `src/lib/invoiceAuth.ts`
- `tests/unit/lib/invoiceOCR.uploadHeaders.test.ts`
- `tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx`

# Verification

Manual checks:

- `OPTIONS /extract` via Vite returned `204` with allowed origin.
- `POST /extract` with valid anonymous token returned `200` and parsed invoice data for `public/test-invoices/invoice-test.pdf`.

Automated checks:

```bash
pnpm vitest tests/unit/lib/invoiceOCR.uploadHeaders.test.ts
pnpm vitest tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx
pnpm vitest tests/unit/lib/invoiceOCR.uploadHeaders.test.ts tests/unit/components/invoice/InvoiceUploadDialog.flow.test.tsx
```

All passed.

# Prevention

- [x] Added unit test asserting no manual multipart `Content-Type` header.
- [x] Added integration-style component flow test for upload -> preview -> import -> complete.
- [x] Added token expiry guard before reusing persisted JWTs.
- [ ] Add `loadEnv()` in `vite.config.ts` to guarantee env-backed proxy target consistency.

# Related Documentation

- `docs/solutions/integration-issues/invoice-proxy-security-hardening-InvoiceOCRProxy-20260210.md`
- `docs/solutions/integration-issues/missing-extract-cache-headers-InvoiceOCR-20260213.md`
- `docs/solutions/performance-issues/invoice-ocr-timeout-and-progress-tracking.md`
