---
module: InvoiceOCR
date: 2026-02-13
problem_type: integration_issue
component: api_client
symptoms:
  - "Repeated POST /extract calls stay slow and never show x-extract-cache=hit"
  - "Response headers like x-extract-cache/x-instance-id/x-process-id missing in curl/browser"
  - "Frontend proxy path (/api/extract-invoice) hides upstream debug headers"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags: [invoice-ocr, fastapi, headers, cache, vercel, proxy, debug]
related_github_issue: null
commit: null
---

# Problem Description

Invoice extraction caching was implemented on the FastAPI `/extract` endpoint, but the frontend still observed 60-70s requests and could not see cache observability headers. This made it impossible to confirm cache hits, multi-worker routing, or whether the running backend included the header changes.

# Symptoms

- Repeating the same PDF upload to `POST /extract` remained slow (no clear warm/hit behavior).
- `x-extract-cache` and related headers did not appear in `curl -D -` output.
- When using the browser path (`/api/extract-invoice`), upstream headers were not visible/forwarded.

# Root Cause Analysis

This was a combination of integration and environment issues:

1. **Backend process mismatch:** The API server was started without `PYTHONPATH=src`, so Python imported an older installed `invproc` package (without the new headers/caching behavior) instead of the repo source tree.
2. **Proxy header passthrough:** The Vercel proxy endpoint did not forward custom cache/debug headers by default.
3. **Frontend header visibility:** The XHR upload path originally discarded response headers (only constructing a `Response` from `responseText`).

# Solution

## 1) Start the InvoiceProcessing API from repo source (not site-packages)

Verify which module path is being imported:

```bash
PYTHONPATH=src python3 -c "import invproc.api; print(invproc.api.__file__)"
```

It must point into your repo `src/invproc/api.py`, not `site-packages`.

Start the API with `PYTHONPATH=src` and cache enabled:

```bash
PYTHONPATH=src \
EXTRACT_CACHE_ENABLED=true \
API_KEYS=dev-key-12345 \
API_HOST=127.0.0.1 \
API_PORT=8000 \
python -m invproc --mode api
```

Verify headers:

```bash
curl -sS -D - -o /dev/null \
  -H 'X-API-Key: dev-key-12345' \
  -F 'file=@public/test-invoices/invoice-test.pdf;type=application/pdf' \
  http://127.0.0.1:8000/extract | rg -i 'x-extract-cache|x-instance-id|x-process-id|^http/'
```

## 2) Forward cache/process headers through the Vercel proxy

Updated `/api/extract-invoice` to forward the upstream observability headers:

- `x-extract-cache`
- `x-instance-id`
- `x-process-id`

Debug-only (opt-in):

- `x-extract-file-hash` only when `INVOICE_PROXY_DEBUG_HEADERS=true`

## 3) Preserve response headers from the XHR upload response

The invoice upload uses `XMLHttpRequest` for upload progress. We parse `xhr.getAllResponseHeaders()` and attach them to the constructed `Response` so `response.headers.get(...)` works.

## 4) Avoid leaking stable document identifiers in production

`x-extract-file-hash` can act as a stable invoice identifier. Best practice is:

- Do not forward it by default from the proxy
- Do not log it client-side by default
- Only enable in local/dev debugging

# Files Changed

- `api/extract-invoice.ts`
- `src/lib/invoiceOCR.ts`

# Prevention

- Always verify your running backend is the repo code: `PYTHONPATH=src python3 -c "import invproc.api; print(invproc.api.__file__)"`
- For cache diagnosis, rely on `x-extract-cache`, `x-instance-id`, `x-process-id` (and avoid file hashes unless explicitly debugging).
- Keep the multipart field name consistent with FastAPI: `file` (some servers will 422 on unexpected field names).

# Related Issues

- See also: `docs/solutions/integration-issues/invoice-proxy-security-hardening-InvoiceOCRProxy-20260210.md`

