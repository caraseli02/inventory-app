---
status: complete
priority: p1
issue_id: "074"
tags: [code-review, security, api, vercel, whatsapp]
dependencies: []
---

# Restore real auth validation in `/api/whatsapp-notify`

## Problem Statement

`/api/whatsapp-notify` still requires an `Authorization: Bearer ...` header, but this branch removed the server-side token validation step. Any caller can now supply any non-empty bearer token and trigger Twilio sends for arbitrary `orderId` values.

This reopens the abuse/cost vector that issue `070` had already closed.

## Findings

- `api/whatsapp-notify.ts:47-53` still parses a bearer token and rejects only the empty case.
- `api/whatsapp-notify.ts:79-81` explicitly documents that auth validation is skipped.
- The previous secure behavior validated the token with Supabase Auth; this PR deletes that check entirely.
- Result: the endpoint no longer has a meaningful authorization boundary, despite exposing a paid Twilio side effect.

## Proposed Solutions

### Option 1: Reinstate Supabase token validation

**Approach:** Restore `sb.auth.getUser(accessToken)` validation and reject invalid tokens before any DB read or Twilio call.

**Pros:**
- Smallest patch
- Restores the previously shipped security boundary
- Keeps the current client flow unchanged

**Cons:**
- Still depends on project auth posture (for example anonymous access policy)
- Endpoint remains publicly reachable

**Effort:** Small

**Risk:** Low

---

### Option 2: Move notify triggering fully server-side

**Approach:** Remove browser access to `/api/whatsapp-notify`; trigger notifications from a trusted server path when order state changes.

**Pros:**
- Best trust boundary
- Better auditability and idempotency control

**Cons:**
- Larger refactor
- Requires coordinating caller changes

**Effort:** Medium

**Risk:** Medium

---

### Option 3: Add a short-lived signed action token

**Approach:** Mint a server-issued action token for the operator session and validate it in the handler.

**Pros:**
- Better than accepting arbitrary bearer strings
- Limits replay window

**Cons:**
- More moving parts than Option 1
- Still weaker than a server-only trigger

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented Option 1. `/api/whatsapp-notify` now validates the bearer token with `sb.auth.getUser(accessToken)` before any order lookup or Twilio send, and a dedicated unit test covers the invalid-token rejection path.

## Technical Details

**Affected files:**
- `api/whatsapp-notify.ts:47`
- `api/whatsapp-notify.ts:79`

## Resources

- **PR:** #156
- **Commit under review:** `ac4a21a`
- **Related todo:** `070-complete-p2-whatsapp-notify-client-shared-secret-auth.md`

## Acceptance Criteria

- [x] `/api/whatsapp-notify` rejects invalid bearer tokens, not just missing ones
- [x] No Twilio message is sent before auth succeeds
- [x] A regression test covers invalid-token rejection
- [x] Docs/comments no longer claim the endpoint is called by Twilio if the browser is the caller

## Work Log

### 2026-03-10 - Review finding

**By:** Codex

**Actions:**
- Compared the current branch against `main`
- Verified the auth validation block was removed from `api/whatsapp-notify.ts`
- Traced the remaining request path through DB read and Twilio send
- Classified the issue as a security regression

**Learnings:**
- The endpoint now accepts any non-empty bearer string, so the auth header is security theater again

### 2026-03-10 - Fix implemented

**By:** Codex

**Actions:**
- Restored Supabase bearer-token validation in `api/whatsapp-notify.ts`
- Switched the serverless Supabase client to non-persistent auth settings
- Added `tests/unit/api/whatsapp-notify.test.ts` covering missing, invalid, and valid bearer tokens
- Verified the targeted unit suite and full typecheck pass

**Learnings:**
- The smallest safe fix was to reinstate the auth gate that this branch had removed, then lock it with a unit test
