---
status: pending
priority: p2
issue_id: "103"
tags: [code-review, security, privacy, whatsapp]
dependencies: []
---

## Problem Statement

Production logs in the WhatsApp webhook and transport layer emit user phone numbers, message content, and template variable values. This constitutes a PII leak that may violate GDPR obligations and expose sensitive user data in log aggregation services (Vercel Runtime Logs, Datadog, etc.).

## Findings

Two locations are affected:

1. **`lib/whatsapp/transport.ts` lines 119-124** — `[TEMPLATE_DEBUG]` block logs template variable keys and values on every `sendListPickerTemplate` call. Template variables can contain product names, quantities, and other order-specific data that may be tied to a natural person via their phone number.

2. **`lib/whatsapp/webhook.ts` lines 494-500, 513, 529** — `console.log` statements output the caller's phone number (`From`) and raw inbound message body (`Body`) unconditionally. Phone numbers are personal data under GDPR Art. 4(1).

Neither location uses a log-level guard or a PII-redaction helper, so the output appears in all environments including production.

## Proposed Solutions

### Option 1: Remove debug logs; replace with redacted structured logging
Remove the `[TEMPLATE_DEBUG]` block entirely (it was clearly added for a temporary investigation). Replace webhook `console.log` calls with a structured logger that redacts or hashes the phone number (e.g., last 4 digits only) and truncates the message body.

**Pros:** Closes the PII leak permanently; aligns with the existing `observability.md` spec.
**Cons:** Loses some debuggability — mitigated by keeping non-PII context (message type, template SID, item count).
**Effort:** Small
**Risk:** Low

### Option 2: Guard all PII logs behind a `DEBUG` env flag
Wrap the logging statements in `if (process.env.LOG_PII === 'true')` so they are off by default in production.

**Pros:** Preserves full fidelity for local debugging.
**Cons:** Relies on the flag being correctly set; any misconfiguration re-opens the leak; does not help if logs are accidentally enabled in production.
**Effort:** Small
**Risk:** Medium

### Option 3: Introduce a `redact(phone)` helper and structured log wrapper
Create a shared utility that replaces the phone number with a stable pseudonym (e.g., SHA-256 truncated to 8 hex chars) and use it throughout the WhatsApp layer.

**Pros:** Consistent, auditable approach; pseudonym still allows correlating a session without storing the real number.
**Cons:** More work than Options 1 or 2; hash must be documented in a data-processing record.
**Effort:** Medium
**Risk:** Low

## Recommended Action
(leave blank)

## Technical Details
- Affected files: `lib/whatsapp/transport.ts`, `lib/whatsapp/webhook.ts`
- Key lines: `transport.ts` 119-124; `webhook.ts` 494-500, 513, 529

## Acceptance Criteria
- [ ] No raw phone numbers appear in production log output
- [ ] No raw message body content appears in production log output
- [ ] `[TEMPLATE_DEBUG]` block is removed or gated behind a non-production flag
- [ ] Remaining log statements retain enough non-PII context for debugging (e.g., message type, template SID, item count)
- [ ] Unit tests or a lint rule prevent re-introduction of bare `console.log(phone)` patterns

## Work Log
- 2026-03-15: Found during code review of feat/whatsapp-template-parity branch
