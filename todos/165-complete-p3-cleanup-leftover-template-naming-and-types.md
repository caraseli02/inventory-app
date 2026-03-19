---
status: complete
priority: p3
issue_id: "165"
tags: [code-review, whatsapp, cleanup]
dependencies: []
---

# Cleanup: remove leftover template-era naming/types (welcomeTemplate, interception naming)

## Problem Statement

After switching to text-only browsing, some names/types still imply template behavior, which adds confusion and makes future refactors harder.

## Findings

- `WhatsAppSimulatorResult.welcomeTemplate` exists in [types.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/types.ts) but the webhook no longer uses a welcome template send path.
- `tryTextTemplateInterception()` in [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) is now mostly “text state machine interception”, not template-specific.

## Proposed Solutions

### Option 1: Rename + delete unused field (recommended)

**Approach:**
- Remove `welcomeTemplate` from the simulator result type and any producers.
- Rename `tryTextTemplateInterception` to something like `tryTextStateInterception`.

**Pros:**
- Reduces cognitive load
- Makes logs/docs match reality

**Cons:**
- Small churn (type and call sites)

**Effort:** 30-60 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] No unused `welcomeTemplate` flag remains.
- [ ] Interception helper name reflects text-only behavior.
- [ ] Typecheck + unit tests pass.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Ran simplicity pass over the confirm-only template refactor.
