---
status: pending
priority: p1
issue_id: "071"
tags: [code-review, security, whatsapp, simulator, vercel, openai]
dependencies: []
---

# Harden `/api/whatsapp-simulate` auth (prevent prod abuse + data leaks)

## Problem Statement

`/api/whatsapp-simulate` can create orders + run OpenAI calls. Today it can be effectively unauthenticated in production (or “authenticated” via a `VITE_` secret that ships to the browser). This is a cost + data exposure risk.

## Findings

- Endpoint auth is optional: if `WHATSAPP_SIMULATOR_SECRET` and `VITE_NOTIFY_SECRET` are both empty, requests are accepted. (`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts:23`)
- Server falls back to `VITE_NOTIFY_SECRET` for auth. `VITE_` env vars are bundled into client JS, so this is not a secret in production. (`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts:23`, `/Users/vladislavcaraseli/Documents/inventory-app/src/pages/WhatsAppSimulatorPage.tsx:47`)
- Simulator can return inventory details via `debug` (and always returns `reply` with product names/prices). If endpoint is open, inventory leaks. (`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts:57`)
- Abuse impact:
  - Unlimited OpenAI spend (`buildSimulatorReply` runs OpenAI when `OPENAI_API_KEY` exists)
  - Order spam in Supabase (`processOrderIntent` inserts into `orders`)

## Proposed Solutions

### Option 1: Server-only secret required on Vercel (recommended)

**Approach:**
- In `api/whatsapp-simulate.ts`, require `WHATSAPP_SIMULATOR_SECRET` when `process.env.VERCEL` is set.
- Remove the `VITE_NOTIFY_SECRET` fallback from server auth (keep it only for local dev tooling if truly needed).
- If not configured on Vercel, return `404` (hide endpoint) or `500` (misconfig).

**Pros:**
- Fixes security + cost exposure without adding new systems
- Clear config story: “simulator endpoint requires server secret”

**Cons:**
- Simulator UI can’t send a server-only secret (needs separate access control or be dev-only)

**Effort:** 1–2 hours

**Risk:** Low

---

### Option 2: Make simulator truly local-only

**Approach:**
- Remove/disable `api/whatsapp-simulate.ts` in production (always 404), keep Vite middleware for local dev only.

**Pros:**
- Zero prod attack surface
- Matches “don’t need production” requirement

**Cons:**
- Can’t test simulator on deployed preview/prod

**Effort:** 30–60 minutes

**Risk:** Low

---

### Option 3: Proper auth + rate limits

**Approach:**
- Protect simulator via one of:
  - Vercel password protection / SSO
  - Supabase Auth session + server-side verification
  - IP allowlist (if stable)
- Add rate limiting (per IP/phone) and request size limits.

**Pros:**
- Strongest long-term solution

**Cons:**
- More plumbing + operational complexity

**Effort:** 0.5–2 days

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts:20`
- `/Users/vladislavcaraseli/Documents/inventory-app/vite.config.ts:47` (local middleware mirrors auth)
- `/Users/vladislavcaraseli/Documents/inventory-app/src/pages/WhatsAppSimulatorPage.tsx:41`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:216` (OpenAI usage + order creation)

## Acceptance Criteria

- [ ] On Vercel, `/api/whatsapp-simulate` rejects requests unless `WHATSAPP_SIMULATOR_SECRET` is set and matches
- [ ] No server auth relies on `VITE_` secrets for production security
- [ ] Debug payload cannot be fetched without auth
- [ ] Documented setup in `/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md:1`

## Work Log

### 2026-03-05 - Review Finding

**By:** Codex

**Actions:**
- Reviewed simulator endpoint auth + UI header usage
- Confirmed server accepts requests when secret is unset
- Identified `VITE_NOTIFY_SECRET` is client-exposed and not suitable for prod auth

**Learnings:**
- This endpoint is a direct cost + data exposure vector once `OPENAI_API_KEY` exists in prod env

