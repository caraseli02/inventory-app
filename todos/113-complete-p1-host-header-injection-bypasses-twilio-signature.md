---
name: Host-header injection bypasses Twilio webhook signature auth
description: When TWILIO_WEBHOOK_URL is not set, getAbsoluteUrl uses user-controlled request headers to construct the validation URL, allowing signature bypass
type: pending
priority: p1
issue_id: "113"
tags: [security, whatsapp, webhook, authentication]
dependencies: []
---

## Problem Statement

`lib/whatsapp/url.ts:7–11` — when `TWILIO_WEBHOOK_URL` env var is absent, `getAbsoluteUrl` builds the URL for Twilio HMAC-SHA1 signature validation from `x-forwarded-proto` and `x-forwarded-host` headers supplied by the caller. An attacker who can reach the serverless endpoint (directly or via misconfigured proxy) can set those headers to a URL they control, compute a valid HMAC-SHA1 against that URL, and bypass signature validation entirely. The entire auth gate at `webhook.ts:525–535` is then void.

## Findings

**Affected file:** `lib/whatsapp/url.ts:7–11`
**Auth gate:** `webhook.ts:525–535`

The header-based fallback was likely added for local development convenience, but it is active in any environment where `TWILIO_WEBHOOK_URL` is not explicitly set — including preview deployments, staging, or misconfigured production.

## Proposed Solutions

### Option A — Make TWILIO_WEBHOOK_URL required (Recommended)
Fail closed with HTTP 500 if `TWILIO_WEBHOOK_URL` is absent. Remove the header-inference fallback entirely.

**Pros:** Eliminates the attack vector completely; forces explicit configuration
**Cons:** Breaks local dev if devs haven't set the env var
**Effort:** Small
**Risk:** Low — adds a startup check

### Option B — Keep fallback but restrict to non-production only
Gate the header-inference path on `!isProduction`. In production, fail closed.

**Pros:** Preserves dev convenience
**Cons:** Still requires every non-prod environment to be explicitly non-production
**Effort:** Small
**Risk:** Medium — misclassified envs still vulnerable

### Option C — Require a second shared secret header in addition to signature
For requests where host cannot be verified from env, require an additional `x-whatsapp-internal-token` header.

**Pros:** Defense in depth
**Cons:** More complex, two secrets to manage
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A. `TWILIO_WEBHOOK_URL` should be required. Add it to `.env.example` and `docs/runbooks/whatsapp_agent.md`.

## Technical Details

- **Affected files:** `lib/whatsapp/url.ts`, `webhook.ts`
- **Auth mechanism:** Twilio HMAC-SHA1 over `POST` URL + sorted body params

## Acceptance Criteria

- [ ] `getAbsoluteUrl` does not read `x-forwarded-proto` / `x-forwarded-host` in production
- [ ] Webhook returns HTTP 500 (or 403) if `TWILIO_WEBHOOK_URL` is unset in production
- [ ] `.env.example` documents `TWILIO_WEBHOOK_URL` as required
- [ ] Unit test: missing `TWILIO_WEBHOOK_URL` causes fail-closed behavior

## Work Log

- 2026-03-17: Identified by security-sentinel review of PR #171
