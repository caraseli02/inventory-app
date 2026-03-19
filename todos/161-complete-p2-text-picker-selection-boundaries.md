---
status: complete
priority: p2
issue_id: "161"
tags: [code-review, whatsapp, ux, state-machine]
dependencies: []
---

# Text picker boundaries: support selection 10 and revisit 6-category cap

## Problem Statement

After removing list-picker templates, browsing is now text-only. Two boundary mismatches can create “it looks like it should work, but doesn’t” UX:

1. Product disambiguation can return 10 items, but numeric parsing only accepts `1-9`.
2. Category browsing is still capped at 6 (a template-era limit) even though text has no such constraint.

## Findings

- `runConversationTurn()` returns `listPicker` for `2..10` candidates in [llm.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts).
- `parseNumericChoice()` only matches a single digit `1-9` in [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts).
- Category picker uses `MAX_LIST_PICKER_ITEMS = 6` in [selection-resolver.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/selection-resolver.ts), originally for template slots.

## Proposed Solutions

### Option 1: Minimal fixes (recommended)

**Approach:**
- Update `parseNumericChoice` to accept `10` (and possibly `0`/`11+` explicitly rejected with a helpful reply).
- Keep category cap at 6 for now, but explicitly message “Trimite 1-6” or add “scrie ‘mai multe’”.

**Pros:**
- Fast, low risk
- Fixes the broken “10” case immediately

**Cons:**
- Still hides categories beyond 6 without a real discovery mechanism

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Raise category cap in text mode

**Approach:** Increase category list to 10-15 (or full list), and ensure numeric parsing supports 2-digit choices.

**Pros:**
- Users can actually browse the full catalog

**Cons:**
- Longer messages; more scrolling; more chance of user error

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 3: Pagination

**Approach:** Add `next` / `prev` semantics to category browsing.

**Pros:**
- Scales with large catalogs

**Cons:**
- More state transitions and tests

**Effort:** 1-2 days

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] If the user replies `10`, the correct selection resolves against `pending_selection`.
- [ ] Category browsing behavior is explicit and tested (either cap + messaging or pagination).
- [ ] Unit tests cover numeric parsing for `10`.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Found mismatch between `listPicker` maximum (10) and numeric parser (1-9).
- Found legacy 6-item cap left over from template-era constraints.
