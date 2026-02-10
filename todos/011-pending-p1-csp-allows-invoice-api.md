---
status: complete
priority: p1
issue_id: "011"
tags: [code-review, security, ops, frontend]
dependencies: []
---

# Allow invoice OCR API in CSP connect-src

Initial issue: CSP blocked invoice OCR requests in production, breaking invoice import.

## Problem Statement

Invoice upload previously failed in production because the browser blocked the POST to the invoice OCR service. This blocked a user-critical feature (invoice import) and presented as a generic network error.

## Findings

- Historical finding: browser console showed CSP violation for `https://invoiceprocessing-g4ol.onrender.com/extract`.
- Current state: CSP in `vercel.json` includes the explicit OCR domain.
- Current state: invoice uploader is proxy-first (`/api/extract-invoice`) in production flow; direct `VITE_INVOICE_API_URL` path is dev fallback only.

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

Keep proxy-first architecture and explicit domain allowlisting; maintain smoke coverage in CI and use a lightweight production verification checklist after deploys that touch CSP or invoice routing.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/vercel.json` - CSP `connect-src`
- `/Users/vladislavcaraseli/Documents/inventory-app/src/lib/invoiceOCR.ts` - proxy-first endpoint selection
- `/Users/vladislavcaraseli/Documents/inventory-app/api/extract-invoice.ts` - server-side proxy route
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/e2e/invoice-smoke.spec.ts` - smoke evidence

**Related components:**
- Invoice upload dialog

**Database changes:** No

## Resources

- Console error: CSP blocked `https://invoiceprocessing-g4ol.onrender.com/extract`
- Screenshot provided by user

## Acceptance Criteria

- [x] Invoice upload succeeds on CI smoke flow (preview build, mocked upstream response)
- [x] No CSP violations for invoice upload flow in smoke test console output
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
- Verified invoice flow targets proxy path (`/api/extract-invoice`) with no CSP console violations in test run
- Confirmed `vercel.json` `connect-src` includes explicit OCR domain (no wildcard)

**Evidence:**
- Playwright result: `1 passed` for invoice smoke test
- Proxy-first client flow in `src/lib/invoiceOCR.ts`
- Note: Smoke test mocks upstream extraction response and does not replace live-production header verification

**Learnings:**
- Proxy-first architecture reduces CSP fragility and avoids browser API key exposure.

## Notes

- If OCR upstream domain changes, update CSP allowlist accordingly.
- For production confidence, run one manual post-deploy check on the live domain after CSP/routing changes.
