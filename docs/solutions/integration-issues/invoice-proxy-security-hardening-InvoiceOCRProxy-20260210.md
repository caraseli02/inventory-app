---
module: InvoiceOCRProxy
date: 2026-02-10
problem_type: integration_issue
component: api_client
symptoms:
  - "Invoice OCR API key visible in browser bundle/network headers"
  - "Invoice upload reliability depended on cross-origin CSP allowlisting"
  - "Security TODO remained open with risk of service abuse"
root_cause: config_error
resolution_type: code_fix
severity: critical
tags: [invoice-ocr, security, csp, vercel, proxy, supabase]
related_github_issue: null
commit: d669a5a
---

# Problem Description

Invoice OCR integration used client-side credentials (`VITE_INVOICE_API_KEY`) and direct cross-origin requests. This created a critical secret-exposure risk and made runtime behavior more fragile when CSP/domain config drifted.

# Symptoms

- API key could be extracted from browser-delivered code or request headers.
- Invoice extraction path depended on external-domain CSP `connect-src` entries.
- Security review flagged production abuse risk and required architecture hardening.

# Root Cause Analysis

Authentication and routing responsibilities were placed in the browser instead of server-side proxy infrastructure.

```typescript
// ❌ BEFORE (client-side secret usage)
const apiKey = import.meta.env.VITE_INVOICE_API_KEY;
if (requireAuth || apiKey) {
  headers['X-API-Key'] = apiKey || '';
}
```

# Solution

Implemented server-side proxy architecture and moved secret handling out of client code.

1. Added Vercel serverless proxy endpoint (`/api/extract-invoice`) to forward multipart uploads.
2. Stored OCR credentials server-side (`INVOICE_API_KEY`, `INVOICE_API_URL`).
3. Added Supabase bearer-token validation in proxy (`auth.getUser`).
4. Updated client extraction flow to proxy-first endpoint selection.
5. Rewrote FastAPI integration/security docs for proxy model.
6. Added smoke test for invoice upload path and CSP-console-error signal.

```typescript
// ✅ AFTER (proxy-first client)
const extractUrl = '/api/extract-invoice';
// Optional bearer token forwarded; API key never read from client env
headers.Authorization = `Bearer ${token}`;
```

# Files Changed

- `api/extract-invoice.ts`
- `src/lib/invoiceOCR.ts`
- `.env.example`
- `docs/FASTAPI_INTEGRATION.md`
- `docs/FASTAPI_SECURITY_GUIDE.md`
- `tests/e2e/invoice-smoke.spec.ts`

# Prevention

- [x] Added smoke test for invoice proxy path and CSP-console-error detection.
- [x] Removed client API-key usage pattern from active integration docs.
- [ ] Add periodic production post-deploy check for invoice route + CSP headers.
- [ ] Keep TODO closure notes aligned with actual test scope (mocked vs live upstream).
