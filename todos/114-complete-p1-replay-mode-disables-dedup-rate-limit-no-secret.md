---
name: Replay mode disables dedup and rate-limit with no shared secret guard
description: x-whatsapp-replay-id header activates replay mode (bypassing dedup + rate-limit) whenever NODE_ENV and VERCEL_ENV are both unset — no secret required
type: pending
priority: p1
issue_id: "114"
tags: [security, whatsapp, replay, rate-limiting]
dependencies: []
---

## Problem Statement

`webhook.ts:509–512` — replay mode is activated by the `x-whatsapp-replay-id` header and is only blocked when `NODE_ENV === 'production'` OR `VERCEL_ENV === 'production'`. If both are unset (preview deployments, staging, cold-start misconfiguration), any caller can include the header to:

1. Bypass `MessageSid` deduplication (duplicate order risk)
2. Bypass per-phone rate limiting (spam/DoS risk)

Combined with finding #113 (signature bypass), an attacker with a stolen Twilio auth token can replay or flood the endpoint without restriction.

## Findings

**Affected lines:** `webhook.ts:509–512, 572, 606`

```ts
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const replayId = !isProduction ? String(req.headers['x-whatsapp-replay-id'] ?? '').trim() || null : null;
```

The check is inverted — it allows bypass when the environment is ambiguous rather than when it is explicitly known to be non-production.

## Proposed Solutions

### Option A — Require a shared REPLAY_SECRET header (Recommended)
Replay mode requires both `!isProduction` AND a valid `x-whatsapp-replay-secret` matching `WHATSAPP_REPLAY_SECRET` env var.

**Pros:** Secret limits access to dev machines that have the env var; no false positives
**Cons:** Adds a secret to manage for local dev
**Effort:** Small
**Risk:** Low

### Option B — Allowlist replay by explicit opt-in env var
`WHATSAPP_REPLAY_ENABLED=true` must be set; production deployments never set this.

**Pros:** Explicit, easy to audit
**Cons:** Doesn't help if the env var leaks
**Effort:** Small
**Risk:** Low

### Option C — Fail closed: require explicit non-production signal
Change check to `isProduction || !process.env.WHATSAPP_ALLOW_REPLAY` — replay only works when the allow-replay flag is explicitly present.

**Effort:** Small
**Risk:** Low

## Recommended Action

Option A. Add `WHATSAPP_REPLAY_SECRET` to `.env.example` and the replay harness script.

## Technical Details

- **Affected files:** `webhook.ts`, `scripts/whatsapp-replay.ts`

## Acceptance Criteria

- [ ] Replay mode requires a secret in addition to non-production env
- [ ] `pnpm whatsapp:replay` passes the secret automatically via env
- [ ] Test: replay header without secret is ignored in all environments
- [ ] Test: replay header with correct secret works in non-production

## Work Log

- 2026-03-17: Identified by security-sentinel review of PR #171
