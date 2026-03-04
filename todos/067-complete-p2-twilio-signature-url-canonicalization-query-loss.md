---
status: complete
priority: p2
issue_id: "067"
tags: [code-review, security, whatsapp, webhook]
dependencies: []
---

# Harden Twilio signature URL canonicalization

## Problem Statement

Webhook signature validation reconstructs URL by stripping query string and relying on reconstructed host/proto. This can produce false negatives for legitimate requests when URL shape differs from signed URL, causing rejected Twilio webhooks.

## Findings

- URL reconstruction in [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L469) drops query params via `.split('?')[0]`.
- Signature validation depends on exact URL/param canonicalization; small mismatches reject valid calls.
- Added unit tests validate helper logic, but no coverage exists for reconstructed URL variants/proxy edge cases.

## Proposed Solutions

### Option 1: Preserve full original URL when available

**Approach:** Use raw request URL including query and trusted forwarded headers; avoid manual truncation.

**Pros:**
- Better parity with Twilio signature expectations
- Minimal code change

**Cons:**
- Requires careful trust boundary for headers

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Add configurable canonical URL override

**Approach:** Add env var for canonical webhook URL used in validation for production stability.

**Pros:**
- Deterministic in proxy/CDN setups
- Easier ops debugging

**Cons:**
- Extra env management

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action


## Technical Details

**Affected files:**
- [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L469)
- [`api/lib/twilio-signature.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/lib/twilio-signature.ts)
- [`tests/unit/lib/twilioSignature.test.ts`](/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/lib/twilioSignature.test.ts)

**Database changes (if any):**
- None

## Resources

- **Branch:** `codex/feat-close-whatsapp-agent-gaps`
- **Runbook:** [`docs/runbooks/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md)

## Acceptance Criteria

- [ ] Signature validation supports canonical URL shape used by Twilio in production
- [ ] Tests cover URL with query params and forwarded header variants
- [ ] No regressions for existing signature tests

## Work Log

### 2026-03-04 - Initial Discovery

**By:** Codex

**Actions:**
- Audited webhook signature validation path
- Reviewed URL reconstruction helper and test coverage
- Identified query-stripping behavior as fragility point

**Learnings:**
- Signature checks are highly sensitive to URL canonicalization details; test coverage should include deployment-specific URL variants

## Notes

- Not blocking merge if current webhook URL has no query params, but should be fixed for robustness.

### 2026-03-04 - Fix Implemented

**By:** Codex

**Actions:**
- Updated URL canonicalization in `api/whatsapp.ts` to preserve query string and use forwarded host/proto precedence.
- Added optional `TWILIO_WEBHOOK_URL` override for deterministic production signature validation.
- Added unit tests in `tests/unit/lib/whatsappUrl.test.ts` for query retention, forwarded-header precedence, and override behavior.

**Learnings:**
- Signature validation stability improves significantly with explicit canonical URL handling and URL-shape tests.
