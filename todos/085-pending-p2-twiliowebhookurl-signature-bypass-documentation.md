---
status: pending
priority: p2
issue_id: "085"
tags: [code-review, security, whatsapp, deployment]
dependencies: []
---

# Document / harden `TWILIO_WEBHOOK_URL` signature-bypass risk

## Problem Statement

`getAbsoluteUrl` in `api/whatsapp.ts` reads `TWILIO_WEBHOOK_URL` from env and returns it verbatim. This value is used as the URL component in Twilio signature HMAC-SHA1 validation. If an attacker gains Vercel env write access, they can set `TWILIO_WEBHOOK_URL` to a URL they control and forge a valid Twilio signature for any payload — completely bypassing webhook authentication.

## Findings

- `api/whatsapp.ts:1633-1641` — `getAbsoluteUrl` returns `TWILIO_WEBHOOK_URL` if set, otherwise reconstructs from trusted Vercel headers.
- The env-var path was added to work around cases where `x-forwarded-host` differs from the Twilio-registered URL. This is legitimate for some Vercel deployment setups.
- If `TWILIO_WEBHOOK_URL` is set correctly, this is not a problem. If it can be tampered with, it is a full auth bypass.
- `docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md` — prior solution confirms signature validation is a hard requirement.

## Proposed Solutions

### Option 1: Add warning comment + deployment runbook note (Minimum)

**Approach:** Add a comment in `getAbsoluteUrl` explaining the security implication. Add `TWILIO_WEBHOOK_URL` to the deployment runbook's security checklist as a deployment-time secret that must not be world-readable.

**Pros:** No code change; low disruption.
**Cons:** Doesn't prevent the attack if env is compromised.
**Effort:** Tiny
**Risk:** None

---

### Option 2: Remove the env override, reconstruct from Vercel headers only (Recommended if Vercel headers are reliable)

**Approach:** Delete the `TWILIO_WEBHOOK_URL` override path. Rely solely on `x-forwarded-proto` + `x-forwarded-host` reconstruction. Vercel sets these headers reliably on production deployments.

**Pros:** Eliminates the bypass path entirely.
**Cons:** May break local testing or preview deployments where the reconstructed URL differs from Twilio's registered URL.
**Effort:** Small
**Risk:** Low (test in staging first)

---

### Option 3: Validate `TWILIO_WEBHOOK_URL` against a whitelist of known deployment domains

**Approach:** At startup, check that `TWILIO_WEBHOOK_URL` (if set) matches `VERCEL_URL` or a configured allow-list of domains.

**Pros:** Defense-in-depth; attacker can't set an arbitrary URL.
**Cons:** Adds startup validation logic; `VERCEL_URL` is not always available.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:1633-1641` — `getAbsoluteUrl`
- `docs/runbooks/whatsapp_agent.md` — deployment checklist

## Acceptance Criteria

- [ ] Security implication of `TWILIO_WEBHOOK_URL` is documented
- [ ] Either the env override is removed, or a domain whitelist is enforced, or a runbook warning is added
- [ ] Signature validation continues to work correctly in production
- [ ] `pnpm typecheck` passes

## Work Log

### 2026-03-10 — Found by security-sentinel review agent

## Resources

- **PR:** #156
- **Prior learning:** `docs/solutions/integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md`
