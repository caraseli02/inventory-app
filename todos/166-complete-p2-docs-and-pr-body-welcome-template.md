---
status: complete
priority: p2
issue_id: "166"
tags: [code-review, whatsapp, docs]
dependencies: []
---

# Docs + PR body drift: welcome template is interactive again

## Problem Statement

We reintroduced a Twilio **welcome** Content Template (quick replies) for first-contact users, but several docs and the PR body still describe the system as “confirmation-only interactive”.

This creates confusion during setup/debug, and can lead to misconfigured env vars (expecting templates to work without REST credentials).

## Findings

- PR body says: “only the confirmation step interactive; everything else is plain text”, but welcome is now interactive again via `TWILIO_WELCOME_*`.
- [docs/compound-engineering.local.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/compound-engineering.local.md) frames messaging as “confirmation uses a Content Template” only.
- [docs/prevention/whatsapp-hardening-strategies.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/prevention/whatsapp-hardening-strategies.md) “Template Send Failure” checklist only mentions `TWILIO_CONFIRM_CONTENT_SID`.
- [docs/runbooks/whatsapp_agent.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md) “Webhook required env vars” omits `TWILIO_ACCOUNT_SID` / `TWILIO_FROM_NUMBER`, even though templates + REST replies require them.

## Proposed Solutions

### Option 1: Update docs + PR body to reflect “welcome + confirm are interactive” (recommended)

**Approach:**
- Update PR body (and/or add a short PR comment) clarifying:
  - Welcome template is sent only on first contact (no conversation history)
  - Confirmation template remains the final DA/NU step
  - Middle of the flow stays text-only
- Update docs to list required env vars for REST sends + templates.

**Pros:**
- Reduces setup confusion immediately
- Keeps runbooks aligned with production behavior

**Cons:**
- Small doc churn

**Effort:** 15-30 min

**Risk:** Low

## Recommended Action

Implemented.

## Acceptance Criteria

- [x] PR body matches current behavior: welcome + confirm templates are interactive; middle is text-only.
- [x] Runbook lists webhook requirements for REST/template sends (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
- [x] Prevention/architecture docs mention welcome template env var(s) when describing template send checks.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Reviewed PR #175 file list and confirmed welcome template behavior is implemented in the webhook.

### 2026-03-19 - Completed

**By:** Codex

**Actions:**
- Updated PR #175 body “Notes” section to reflect welcome + confirmation templates.
- Updated docs:
  - docs/compound-engineering.local.md
  - docs/prevention/whatsapp-hardening-strategies.md
  - docs/runbooks/whatsapp_agent.md
- Ran: pnpm lint, pnpm typecheck, pnpm test:unit, pnpm test:integration
