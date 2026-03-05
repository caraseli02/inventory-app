---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, security, api, vercel, whatsapp]
dependencies: []
---

# WhatsApp notify: avoid client-shipped “shared secret” auth

## Problem Statement

`/api/whatsapp-notify` uses a “shared secret” (`VITE_NOTIFY_SECRET`) sent from the React client in an `x-notify-secret` header. Because it’s a **VITE_** env var, it can be bundled into client code and is not a real secret.

This weakens the authorization boundary for sending WhatsApp messages via Twilio (abuse/cost risk).

## Findings

- Client previously sent `x-notify-secret` from `import.meta.env.VITE_NOTIFY_SECRET`.
- Serverless handler previously verified against `process.env.VITE_NOTIFY_SECRET`.
- This pattern assumes `VITE_NOTIFY_SECRET` is secret, but `VITE_` naming convention implies it can be exposed client-side (at minimum through the built bundle / browser).

## Proposed Solutions

### Option 1: Move notification trigger server-side (best security)

**Approach:** Don’t call `/api/whatsapp-notify` from the browser. Trigger notifications from a server-side place:
- Supabase trigger / Edge Function on `orders.status` updates, or
- A server-side endpoint called by a trusted environment only, or
- A backend job that reacts to state changes.

**Pros:**
- Removes browser as an attack vector
- No shared secret distribution
- Strong auditability (single source of truth)

**Cons:**
- Requires additional infra or trigger plumbing
- Needs careful idempotency (avoid duplicate sends)

**Effort:** Medium

**Risk:** Medium

---

### Option 2: Authenticate with real user/session auth

**Approach:** Protect `/api/whatsapp-notify` using real app auth:
- Require user session/cookie and authorize operator role, or
- Use Supabase JWT verification server-side.

**Pros:**
- Stronger than shared secret
- Keeps same request flow (client still calls endpoint)

**Cons:**
- Still exposes endpoint publicly (but authenticated)
- Requires auth wiring in serverless

**Effort:** Small–Medium

**Risk:** Low–Medium

---

### Option 3: Short-lived signed token

**Approach:** The server issues a short-lived token (JWT) for the current session; client uses it for notify calls.

**Pros:**
- Limits replay window
- Keeps UX unchanged

**Cons:**
- More complexity than session auth
- Still not as robust as server-side triggering

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Implemented a pragmatic Option 2 variant: `/api/whatsapp-notify` now requires an `Authorization: Bearer <supabase_access_token>` header, removing the client-bundled “secret” from the auth mechanism.

Notes:
- This is only a strong authorization boundary if your Supabase project does **not** allow anonymous sign-in.
- The longer-term best practice remains server-side triggering (DB trigger / Edge Function) for notifications.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/api/whatsapp-notify.ts`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/docs/runbooks/whatsapp_agent.md`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/.env.example`

## Resources

- Twilio WhatsApp send endpoint is cost/abuse sensitive

## Acceptance Criteria

- [x] Browser no longer relies on a bundled “secret” for authorization
- [x] `/api/whatsapp-notify` rejects requests without a Bearer token
- [x] Runbook/docs no longer instruct `VITE_NOTIFY_SECRET` for `/api/whatsapp-notify`
- [ ] Strong authorization boundary exists (requires disabling anonymous sign-in or adding operator auth; follow-up recommended)

## Work Log

### 2026-03-05 - Initial Discovery

**By:** Codex

**Actions:**
- Traced auth flow for `/api/whatsapp-notify`
- Verified client uses `VITE_NOTIFY_SECRET` header
- Identified authorization weakness inherent to VITE_ secrets
- Drafted options (server-side trigger vs session auth)

**Learnings:**
- “Shared secret in the browser” is security theater; move trust boundary server-side where possible

### 2026-03-05 - Bearer token gate implemented

**By:** Codex

**Actions:**
- Updated `OrderCard` to send `Authorization: Bearer <supabase_access_token>` for `/api/whatsapp-notify`.
- Updated serverless handler to validate the token via `sb.auth.getUser(accessToken)` and reject missing/invalid tokens.
- Updated `.env.example` and `docs/runbooks/whatsapp_agent.md` to remove `VITE_NOTIFY_SECRET` from the notify endpoint requirements.

**Files:**
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/src/pages/orders/OrderCard.tsx`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/api/whatsapp-notify.ts`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/.env.example`
- `/Users/vladislavcaraseli/.codex/worktrees/23f4/inventory-app/docs/runbooks/whatsapp_agent.md`

**Learnings:**
- Without operator auth, token-based gating is only meaningful if anonymous sign-in is disabled.
