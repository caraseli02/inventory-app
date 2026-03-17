---
module: WhatsAppAgent
date: 2026-03-16
problem_type: logic_error
component: webhook_handler
symptoms:
  - "x-whatsapp-replay-id header bypasses per-phone rate limiting and MessageSid deduplication in production"
  - "Any caller can inject arbitrary replay session IDs into production webhook"
  - "replayId value from HTTP header used directly in path.join() without sanitization"
  - "Crafted header value could write files outside .tmp/whatsapp-replay/"
root_cause: missing_validation
resolution_type: code_fix
severity: critical
tags: [security, path-traversal, replay-mode, rate-limiting, dedup, production-guard, header-injection]
related_github_issue: null
commit: null
---

# Problem Description

The WhatsApp replay infrastructure had two security issues discovered during code review:

1. **Path traversal** — `replayId` from the `x-whatsapp-replay-id` HTTP header was interpolated directly into a `path.join()` call in `lib/whatsapp/replay-context.ts` without sanitization. A crafted header value like `../../etc/cron.d/malicious` could write arbitrary files on the server filesystem.

2. **Missing production guard** — The `x-whatsapp-replay-id` header was accepted in all environments. In production, this allowed any caller to bypass per-phone rate limiting and MessageSid deduplication by including this header. The replay header also suppressed real Twilio REST sends (writes go to disk instead), which could be exploited to silently drop messages.

Neither vulnerability was exploited in practice (the replay feature was a dev/test tool), but both needed to be closed before shipping to production traffic.

# Symptoms

- No user-visible symptoms in normal operation
- In an attack scenario: files written outside `.tmp/whatsapp-replay/` on the server; rate limiting bypassed with arbitrary `x-whatsapp-replay-id: anything` header; message sends silently suppressed
- Discovered via security code review of the `feat/whatsapp-template-parity` branch

# Root Cause Analysis

**Path traversal:**

```typescript
// ❌ BEFORE — unsanitized header value directly in path.join()
function getReplayFile(replayId: string): string {
  return path.join(getReplayDir(), `${replayId}.jsonl`);
  // replayId = "../../etc/cron.d/evil" → writes outside replay dir
}
```

`path.join` resolves `..` segments, so `path.join('/app/.tmp/whatsapp-replay', '../../etc/passwd')` resolves to `/app/etc/passwd`. Combined with `fs.mkdir({ recursive: true })` creating intermediate directories, this was a full arbitrary file write primitive.

**Missing production guard:**

```typescript
// ❌ BEFORE — replay active in all environments
const replayId = String(req.headers['x-whatsapp-replay-id'] ?? '').trim() || null;
// Then later:
if (!replayId && messageSid) { await checkAndMarkMessageSid(...); }  // skipped!
if (!replayId) { await checkRateLimit(...); }                        // skipped!
```

Any HTTP client could send `x-whatsapp-replay-id: anything` to a production webhook endpoint and bypass both the dedup and rate limit guards.

# Solution

**Fix 1 — Sanitize `replayId` with allowlist + containment check (defense in depth):**

```typescript
// ✅ AFTER — allowlist strips traversal characters; containment check is second layer
function sanitizeReplayId(replayId: string): string {
  // Allow only alphanumeric, hyphens, underscores, and dots
  return replayId.replace(/[^a-zA-Z0-9_.-]/g, '');
}

function getReplayFile(replayId: string): string {
  const safe = sanitizeReplayId(replayId);
  const filePath = path.join(getReplayDir(), `${safe}.jsonl`);
  // Second layer: verify resolved path stays inside replay dir
  const replayDir = getReplayDir();
  if (!filePath.startsWith(replayDir + path.sep) && filePath !== replayDir) {
    throw new Error(`Invalid replay ID: path escapes replay directory`);
  }
  return filePath;
}
```

Two independent defenses:
- The regex allowlist strips `..`, `/`, `\`, `%`, and all other traversal characters before path resolution
- The containment check catches any edge cases (encoded sequences, OS-specific normalization) that slip past the regex

**Fix 2 — Gate replay mode to non-production environments:**

```typescript
// ✅ AFTER — replay header ignored in production
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

const replayId = !isProduction
  ? String(req.headers['x-whatsapp-replay-id'] ?? '').trim() || null
  : null;  // header silently ignored in production
```

Check both `NODE_ENV` and `VERCEL_ENV` since Vercel sets the latter independently.

# Files Changed

- `lib/whatsapp/replay-context.ts` — added `sanitizeReplayId()`, containment check in `getReplayFile()`
- `lib/whatsapp/webhook.ts` — added `isProduction` check before reading `x-whatsapp-replay-id` header

# Prevention

**Rule 1 (Path traversal):** Any HTTP header, query parameter, or request body value used to construct a filesystem path must be: (a) stripped to an explicit allowlist of safe characters, and (b) verified to resolve within the intended directory after `path.resolve()`.

**Rule 2 (Dev-only features):** Debug/test headers that modify request handling must be explicitly disabled in production. Inline `if` guards are not sufficient — the check must fail closed (`null` by default in prod, not just gated).

**Detection in code review:**
- Flag: `path.join(someDir, req.headers['...'])` or any template literal constructing a path from request data
- Flag: Feature flags checking `NODE_ENV !== 'production'` without also checking `VERCEL_ENV` or equivalent platform vars
- Search pattern: `req.headers` → `path.join` within 5 lines

**Test case suggestions:**
- Unit test: pass `../../etc/passwd` as `replayId` to `getReplayFile()` and assert it throws
- Unit test: pass valid ID and assert path is inside replay dir
- Integration test: start server with `NODE_ENV=production`, assert `x-whatsapp-replay-id` header has no effect on rate limiting

- [x] `sanitizeReplayId()` strips traversal characters
- [x] Containment check added as second layer
- [x] Production env guard added to webhook handler
- [ ] Unit tests for `getReplayFile()` path sanitization edge cases

## Related Solutions

- [`docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`](../integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md) — related: webhook request authentication (Twilio signature validation)
- [`docs/solutions/dx-issues/whatsapp-replay-captures-async-transport-WhatsAppAgent-20260313.md`](../dx-issues/whatsapp-replay-captures-async-transport-WhatsAppAgent-20260313.md) — related: replay infrastructure architecture
