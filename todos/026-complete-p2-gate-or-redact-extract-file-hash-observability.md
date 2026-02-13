---
status: complete
priority: p2
issue_id: "026"
tags: [code-review, invoice-ocr, security, observability]
dependencies: []
---

# Gate Or Redact `x-extract-file-hash` Observability

We currently forward and log cache/debug headers from the invoice extraction service. This is useful for diagnosing cache hit rates and multi-worker behavior, but `x-extract-file-hash` can act as a stable identifier for a specific invoice PDF.

## Problem Statement

Even a truncated file hash can become a correlation identifier for sensitive documents. If enabled in production by mistake, it can leak into:

- Browser-accessible headers
- Client logs (console / log drain)
- Proxies and edge logs

## Findings

- Proxy forwards `x-extract-file-hash` when present:
  - `api/extract-invoice.ts:122-146`
- Client logs `x-extract-file-hash` when present:
  - `src/lib/invoiceOCR.ts:437-456`
- Backend only sets the header when `EXTRACT_CACHE_DEBUG_HEADERS=true` (expected), but the frontend/proxy should still be defensive against accidental enablement.

## Proposed Solutions

### Option 1: Do Not Forward Or Log `x-extract-file-hash` By Default (Recommended)

**Approach:**
- Remove `x-extract-file-hash` from the default proxy allowlist.
- Do not log `fileHash` client-side unless `import.meta.env.DEV` or an explicit opt-in env var is set.
- Keep forwarding/logging `x-extract-cache`, `x-instance-id`, `x-process-id`.

**Pros:**
- Stronger privacy posture by default.
- Still preserves the most important diagnostic fields for cache vs multi-worker.

**Cons:**
- Debugging "cache key mismatch" is slightly harder without explicit opt-in.

**Effort:** 20-30 minutes

**Risk:** Low

---

### Option 2: Keep Forwarding, But Redact

**Approach:** Forward/log only a shorter prefix (e.g., first 6 chars) or hash the hash again before exposing.

**Pros:**
- Still supports correlation in local debugging.

**Cons:**
- Still a stable identifier; redaction lowers but does not remove the risk.

**Effort:** 20-30 minutes

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `api/extract-invoice.ts`
- `src/lib/invoiceOCR.ts`

## Acceptance Criteria

- [ ] Production default does not expose `x-extract-file-hash` to browsers.
- [ ] Cache/multi-worker diagnosis still works via `x-extract-cache`, `x-instance-id`, `x-process-id`.
- [ ] Unit tests pass (`pnpm test:unit`).

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Codex

**Actions:**
- Identified that `x-extract-file-hash` is forwarded by the proxy and logged client-side when present.

**Learnings:**
- The backend intends this header to be debug-only, but frontend/proxy should be defensive.

---

### 2026-02-13 - Fix Implemented

**By:** Codex

**Actions:**
- Removed `x-extract-file-hash` from the default proxy passthrough allowlist; only forward when `INVOICE_PROXY_DEBUG_HEADERS=true`.
- Kept forwarding `x-extract-cache`, `x-instance-id`, `x-process-id` for production-safe diagnosis.
- Updated client-side logging to treat `x-extract-file-hash` as debug-only; it is only logged in dev or when `VITE_INVOICE_DEBUG_HEADERS=true`.
- Ran `pnpm lint` and `pnpm test:unit` (pass).

**Learnings:**
- Cache/worker diagnosis doesn’t require a stable document identifier; keep that strictly opt-in.
