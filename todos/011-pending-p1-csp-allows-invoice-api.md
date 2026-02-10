---
status: complete
priority: p1
issue_id: "011"
tags: [code-review, security, ops, frontend]
dependencies: []
---

# Allow invoice OCR API in CSP connect-src

CSP blocks invoice OCR requests in production, breaking invoice import.

## Problem Statement

Invoice upload fails in production because the browser blocks the POST to the invoice OCR service. This blocks a user-critical feature (invoice import) and presents as a generic network error.

## Findings

- Browser console shows CSP violation: `connect-src` blocks `https://invoiceprocessing-g4ol.onrender.com/extract`.
- CSP is defined in `/Users/vladislavcaraseli/Documents/inventory-app/vercel.json` and does not include the invoice OCR service domain.
- The invoice uploader calls `/extract` on `VITE_INVOICE_API_URL` (defaulting to `http://localhost:8000`), so production requires an allowlisted HTTPS domain.

## Proposed Solutions

### Option 1: Add specific OCR domain to CSP (recommended)

**Approach:** Update `vercel.json` CSP `connect-src` to include `https://invoiceprocessing-g4ol.onrender.com` (or the exact production API domain).

**Pros:**
- Minimal change
- Keeps CSP tight
- Fixes production immediately

**Cons:**
- Requires CSP update if domain changes

**Effort:** 15-30 minutes

**Risk:** Low

---

### Option 2: Use first-party proxy and only allow same-origin

**Approach:** Route OCR requests through a Vercel API route (same origin), keep CSP `connect-src 'self'`.

**Pros:**
- Simplifies CSP
- Keeps secrets server-side

**Cons:**
- More code and maintenance
- Adds latency and infra costs

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Allow `*.onrender.com` in CSP

**Approach:** Add `https://*.onrender.com` to `connect-src`.

**Pros:**
- Flexible if domain changes

**Cons:**
- Overbroad; weakens CSP

**Effort:** 10 minutes

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/vercel.json` - CSP `connect-src`
- `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceOCR.ts` - uses `VITE_INVOICE_API_URL`

**Related components:**
- Invoice upload dialog

**Database changes:** No

## Resources

- Console error: CSP blocked `https://invoiceprocessing-g4ol.onrender.com/extract`
- Screenshot provided by user

## Acceptance Criteria

- [x] Invoice upload succeeds on production-equivalent smoke flow (CI preview mode)
- [x] No CSP violations for OCR endpoint in console (smoke test)
- [x] CSP remains least-privilege (no wildcard if not required)

## Work Log

### 2026-02-06 - Initial Discovery

**By:** Codex

**Actions:**
- Located CSP policy in `vercel.json`
- Confirmed missing OCR domain in `connect-src`
- Documented options and risks

**Learnings:**
- CSP needs explicit OCR domain allowlist to permit cross-origin upload

### 2026-02-10 - Validation and Closure

**By:** Codex

**Actions:**
- Added dedicated smoke test: `tests/e2e/invoice-smoke.spec.ts`
- Executed: `CI=1 pnpm playwright test tests/e2e/invoice-smoke.spec.ts`
- Verified invoice flow uses proxy path (`/api/extract-invoice`) and no CSP console violations
- Confirmed `vercel.json` `connect-src` includes explicit OCR domain (no wildcard)

**Evidence:**
- Playwright result: `1 passed` for invoice smoke test
- Proxy-first client flow in `src/lib/invoiceOCR.ts`

**Learnings:**
- Proxy-first architecture reduces CSP fragility and avoids browser API key exposure.

## Notes

- If `VITE_INVOICE_API_URL` changes, CSP must be updated accordingly.
