---
status: complete
priority: p1
issue_id: "179"
tags: [code-review, whatsapp, order-flow, correctness, regression]
dependencies: []
---

# List-picker followup may fail without inventoryText/history (non-local providers)

## Problem Statement

After switching non-local LLM providers to tool-first prompts (no `INVENTAR LIVE` injection), `runConversationTurn()` returns `listPicker` results without persisting the list options into conversation history. On the next turn (user replies `1`), `maybeHandleMenuSelection()` may not be able to resolve which product was chosen because:

- `optionsFromMenu` relies on the assistant list being present in history
- `optionsFromInventory` relies on `inventoryText` having bullet lines

For non-local providers, `inventoryText` is intentionally `''`, and the assistant list is not appended when `listPicker` returns early. This can break the common flow:

1) User: `Vreau 2 lapte maine 12:00` → list picker with options
2) User: `1` → expected: create `ORDER:{...}` for chosen product

## Findings

- List-picker return path returns early and skips `appendHistory()`: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:223`
- For non-local providers, `inventoryText` is `''`: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:217`
- `maybeHandleMenuSelection()` needs either:
  - prior assistant menu in history (`findLastMenuOptions()`), or
  - bullet list from `inventoryText` (`extractInventoryNames()`): `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts:278`

Risk: regression vs previous behavior where `inventoryText` was populated and could drive `optionsFromInventory` on the follow-up turn.

## Proposed Solutions

### Option 1: Persist the displayed list into history when returning `listPicker` (recommended)

**Approach:**
- When `runConversationTurn()` decides to return `listPicker`, also `appendHistory()` with a text representation of the same options the user sees (numbered list or Twilio list title items).
- Keep `reply: ''` so transport can still send interactive list-picker; the stored assistant text is only for state continuity.

**Pros:**
- Preserves numeric follow-up behavior (`1`) without reintroducing full inventory injection
- Aligns with prior “menu-selection deterministic” solution patterns

**Cons:**
- Must ensure stored assistant list matches what user actually received (avoid drift)

**Effort:** 1–2 hours
**Risk:** Medium

---

### Option 2: Compute minimal `inventoryText` (names-only) for product_query follow-ups

**Approach:** For `product_query`, populate `inventoryText` with only product names (no price/stock) so `optionsFromInventory` works.

**Pros:** Minimal history coupling.
**Cons:** Adds another “inventory-like” prompt surface; can confuse other logic.
**Effort:** 1–2 hours
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [x] For non-local LLM providers, a `listPicker` turn is persisted to history in a form that enables `maybeHandleMenuSelection()` on the next message.
- [x] Multi-turn flow “qty+time → listPicker → user replies `1` → ORDER created” is covered by a unit or integration test.
- [ ] No regression: stale history must not revive an older pending order (verify against `docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`).

## Work Log

### 2026-03-20 - Created from ce:review synthesis

**By:** Codex

**Actions:**
- Identified early-return listPicker path skipping history persistence under tool-first prompt mode.

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- On list-picker early return, append a numbered list to history for state continuity (`lib/whatsapp/llm.ts`).
- Added unit test verifying history persistence on list-picker path (`tests/unit/whatsappLlmInventoryPrompt.test.ts`).
