---
module: WhatsAppWebhook
date: 2026-03-04
problem_type: integration_issue
component: webhook_handler
symptoms:
  - "POST /api/whatsapp accepted requests without Twilio signature verification"
  - "Webhook could be forged to trigger Anthropic + Supabase work"
root_cause: missing_validation
resolution_type: code_fix
severity: high
tags: [twilio, whatsapp, webhook, signature, vercel, security]
related_github_issue: 125
commit: 7d490b1
---

# Problem Description

`POST /api/whatsapp` (Twilio WhatsApp webhook) did not verify `X-Twilio-Signature`, so non-Twilio callers could hit the endpoint and trigger expensive downstream work (Anthropic + Supabase).

# Symptoms

- Requests without `X-Twilio-Signature` were processed normally.
- Modified payloads were not rejected before calling external services.

# Root Cause Analysis

Twilio webhook signature validation was missing entirely. Correct validation requires:

- the exact absolute URL Twilio signed (incl. `x-forwarded-proto` + `host` + `/api/whatsapp`)
- the parsed form-urlencoded params (sorted key concatenation)
- HMAC-SHA1 with `TWILIO_AUTH_TOKEN` and base64 digest comparison

# Solution

1. Added a pure helper to compute + validate Twilio signatures.
2. In `api/whatsapp.ts`, reconstruct the absolute URL and normalize params.
3. Fail closed: missing/invalid signature → `403` and do not call Anthropic/Supabase.
4. Added unit tests to lock behavior.

## Key code

- `api/lib/twilio-signature.ts` exports `computeTwilioSignature` + `validateTwilioSignature` (timing-safe compare).
- `api/whatsapp.ts` enforces validation at the top of the handler.

# Files Changed

- `api/whatsapp.ts`
- `api/lib/twilio-signature.ts`
- `tests/unit/lib/twilioSignature.test.ts`

# Prevention

- [x] Added unit tests for signature validation.
- [ ] Add a small integration test with a recorded Twilio sample (optional).

