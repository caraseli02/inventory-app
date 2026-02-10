---
module: InvoiceUploadDialog
date: 2026-02-10
problem_type: integration_issue
component: dialog_component
symptoms:
  - "Invoice upload fails after ~120s with timeout message even when backend is still processing"
  - "Browser console flooded with BNM exchange-rate CORS errors on invoice preview"
  - "Local dev flow requires manual retries and noisy logs before import can proceed"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags: [invoice-ocr, fastapi, timeout, cors, fx-rate, local-dev]
related_github_issue: null
commit: null
---

# Problem Description

Local invoice import against a FastAPI server failed in development due to two integration issues:
1. frontend request timeout was shorter than backend processing window,
2. invoice preview tried to fetch BNM rates directly from browser, which is blocked by CORS.

This produced false-negative upload failures and noisy console errors.

# Symptoms

- Uploading `invoice-test.pdf` from UI failed with timeout around 120s.
- FastAPI could still complete extraction later, but frontend had already aborted.
- Console showed repeated `No 'Access-Control-Allow-Origin' header` errors from `https://bnm.md/...`.
- Invoice dialog showed FX section while backend extraction itself was otherwise working.

# Root Cause Analysis

Two configuration/integration mismatches:

1. **Timeout mismatch**
- Frontend `XMLHttpRequest.timeout` minimum was 120000ms.
- Backend processing for larger invoices can exceed 120s in local/dev environments.
- Result: client aborts first and returns timeout error.

2. **Direct third-party FX fetch from browser**
- Invoice dialog attempted BNM XML fetch on preview load.
- BNM endpoint does not allow this browser origin via CORS.
- Result: repeated fetch failures and console noise.

# Solution

Applied two fixes:

1. **Raised frontend upload timeout floor to 210s** in invoice OCR client.
2. **Switched invoice FX to manual-only mode** in dialog and removed BNM auto-fetch path.

This keeps local dev stable and removes external CORS dependency for invoice import.

```typescript
// src/lib/invoiceOCR.ts
const MIN_UPLOAD_TIMEOUT_MS = 210000;

function getUploadTimeoutMs(fileSizeBytes: number): number {
  const sizeAdaptiveMs = (fileSizeBytes / (1024 * 1024)) * 1000 + 60000;
  return Math.max(MIN_UPLOAD_TIMEOUT_MS, sizeAdaptiveMs);
}
```

```typescript
// src/components/invoice/InvoiceUploadDialog.tsx
// Manual-only FX mode: do not call BNM endpoint from browser (CORS).
useEffect(() => {
  if (!invoiceData) return;
  setFxRateError(null);
}, [invoiceData]);
```

# Files Changed

- `src/lib/invoiceOCR.ts`
  - Added `getUploadTimeoutMs()` with 210s minimum timeout.
  - Updated timeout logging and user-facing timeout message.
- `src/components/invoice/InvoiceUploadDialog.tsx`
  - Removed BNM auto-fetch integration for FX rate.
  - Removed BNM-specific UI state/handlers/labels.
  - Kept manual FX input as the single path.

# Verification

- Local FastAPI check:
  - CORS preflight to `/extract` works for `http://localhost:5173`.
  - Small invoice (`invoice-test-single-item.pdf`) returns 200 with extracted JSON.
- Frontend build check:
  - `pnpm build` passes after both changes.
- UX check:
  - Invoice preview works without BNM CORS spam.
  - Manual FX entry allows import flow continuation.

# Prevention

- Keep frontend timeout strictly above backend timeout budget for long-running extraction.
- Avoid direct browser fetches to third-party endpoints lacking CORS support.
- If auto-FX is needed later, fetch FX server-side (proxy/edge function) and return normalized value to client.
- Add explicit local-dev checklist for invoice flow:
  - `VITE_INVOICE_API_URL=http://localhost:8000`
  - FastAPI running with local auth policy
  - manual FX mode confirmed.
