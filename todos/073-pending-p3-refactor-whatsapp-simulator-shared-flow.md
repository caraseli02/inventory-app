---
status: pending
priority: p3
issue_id: "073"
tags: [code-review, quality, whatsapp, simulator, refactor]
dependencies: []
---

# Refactor WhatsApp simulator flow to reduce duplication

## Problem Statement

`buildSimulatorReply()` (OpenAI path) and `buildReply()` (Anthropic path) duplicate the same flow: intent → inventory summary → menu selection → followup handling → history persistence → order processing. This makes future changes risky and easy to diverge.

## Findings

- Same logic exists twice with small provider differences. (`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:216`, `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:339`)
- Recent bug fixes (menu selection + history await) had to be applied in both places.
- Extra complexity makes it harder to reason about “WhatsApp vs simulator” behavior guarantees.

## Proposed Solutions

### Option 1: Extract provider-agnostic pipeline (recommended)

**Approach:**
- Create a helper that:
  - loads history
  - computes inventoryText
  - handles menuSelection / followup
  - calls a `generateReply({ provider })` callback only when needed
  - persists history + returns `processOrderIntent` result

**Pros:**
- Single source of truth for flow logic
- Fewer regressions

**Cons:**
- Some TypeScript gymnastics around provider return types

**Effort:** 2–4 hours

**Risk:** Medium

---

### Option 2: Keep duplication but add strict tests

**Approach:**
- Add tests that assert both providers behave identically for key scenarios (inventory fallback, menu selection, followup).

**Pros:**
- Lowest code churn

**Cons:**
- Still duplicated logic

**Effort:** 2–3 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:216`
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:339`

## Acceptance Criteria

- [ ] No duplicated “flow orchestration” logic between providers
- [ ] Unit tests still pass (`tests/unit/whatsappInventory.test.ts`)
- [ ] Manual simulator flow remains unchanged

## Work Log

### 2026-03-05 - Review Finding

**By:** Codex

**Actions:**
- Compared OpenAI and Anthropic reply builders
- Identified duplicated orchestration and risk of drift

