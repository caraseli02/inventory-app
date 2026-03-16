---
status: pending
priority: p1
issue_id: "100"
tags: [code-review, security, whatsapp, rate-limiting]
dependencies: []
---

## Problem Statement

The `x-whatsapp-replay-id` request header, when present, causes `checkAndMarkMessageSid()` deduplication and per-phone rate limiting to be skipped entirely in `lib/whatsapp/webhook.ts`. There is no restriction of this bypass to development or test environments — it works identically in production. Any external caller who can send HTTP requests to the webhook endpoint can include this header and issue unlimited requests, bypassing both replay-attack protection and rate limiting. This enables unconstrained consumption of LLM API quota and Supabase read/write operations at the attacker's choosing.

## Findings

- `lib/whatsapp/webhook.ts` reads `x-whatsapp-replay-id` from the request and, if present, skips the `checkAndMarkMessageSid` call and the per-phone rate-limit check.
- No `NODE_ENV` / `VERCEL_ENV` guard prevents this code path from executing in production.
- The webhook endpoint is publicly reachable (it is a Twilio callback URL).
- Twilio request signature validation may be the only defence remaining on this path — but signature validation is itself sometimes disabled in test/dev modes, which compounds the risk.
- An attacker who can spoof or replay Twilio-signed requests (or exploit any gap in signature validation) can drive unbounded LLM and DB costs.

## Proposed Solutions

### Option 1: Restrict replay bypass to non-production environments only
Wrap the replay-id skip in an environment check:

```typescript
const isReplay = req.headers['x-whatsapp-replay-id'] &&
  process.env.VERCEL_ENV !== 'production' &&
  process.env.NODE_ENV !== 'production';
```

**Pros:** Minimal change, preserves dev/test workflow exactly as-is, production is protected immediately.
**Cons:** Still relies on environment variables being set correctly; does not eliminate the attack surface in staging environments.
**Effort:** Small
**Risk:** Low

### Option 2: Replace open header with a shared secret
Require the replay header to include a value matching a server-side secret (e.g. `WHATSAPP_REPLAY_SECRET` env var). Requests without the correct secret are treated as normal production traffic.

```typescript
const replaySecret = process.env.WHATSAPP_REPLAY_SECRET;
const isReplay = replaySecret &&
  req.headers['x-whatsapp-replay-id'] &&
  req.headers['x-whatsapp-replay-secret'] === replaySecret;
```

**Pros:** Works in all environments; secret rotation is straightforward; replay tooling continues to function with the secret configured.
**Cons:** Secret must be kept out of version control and set in all relevant environments. Replay scripts need updating.
**Effort:** Small
**Risk:** Low

### Option 3: Use a dedicated internal replay endpoint
Move replay logic to a separate route (e.g. `/api/whatsapp-replay`) that is blocked at the edge/CDN from external traffic (Vercel `vercel.json` route protection or IP allowlist). The public webhook never has a bypass path.

**Pros:** Cleanest architecture; no special header logic in the production webhook at all.
**Cons:** Requires routing changes and CDN/edge configuration; replay tooling must target the new route.
**Effort:** Medium
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/webhook.ts`
- Components: webhook handler, `checkAndMarkMessageSid`, per-phone rate limiter

## Acceptance Criteria
- [ ] Sending `x-whatsapp-replay-id` to the production webhook no longer bypasses rate limiting or deduplication
- [ ] Existing `pnpm whatsapp:replay` tooling continues to work in development
- [ ] Integration test asserts that rate limiting fires for replay-header requests in production mode
- [ ] Security review sign-off on chosen option before merge

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
