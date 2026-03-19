---
status: pending
priority: p3
issue_id: "167"
tags: [code-review, whatsapp, cleanup]
dependencies: []
---

# Cleanup: stale comments and minor duplication around templates/list sizes

## Problem Statement

Some comments and small bits of logic still reflect the old “template list-picker” era, which makes future maintenance harder and can mislead reviewers/operators.

## Findings

- [lib/whatsapp/selection-resolver.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts) has:
  - `MAX_LIST_PICKER_ITEMS = 10` but the comment references a Twilio template with `product_1..product_6`.
- [lib/whatsapp/webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) duplicates welcome SID detection logic instead of reusing the helper in `welcome-prompt.ts`.

## Proposed Solutions

### Option 1: Edit comments + reuse helper (recommended)

**Approach:**
- Update the `MAX_LIST_PICKER_ITEMS` comment to describe the **text-numbered list** cap (10), not Twilio template limits.
- Export a `getWelcomeContentSid()` (or `hasWelcomeTemplateConfigured()`) helper from `welcome-prompt.ts` and reuse it in the webhook for `shouldSendWelcome`.

**Pros:**
- Less misleading code
- Small, safe diff

**Cons:**
- Minor churn

**Effort:** 10-20 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] Comments no longer mention `product_1..product_6` in text-only paths.
- [ ] Webhook welcome SID detection uses a single helper source of truth.
- [ ] `pnpm lint` and `pnpm typecheck` pass.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Noted doc/comment drift after template rollback + reintroducing welcome template.

