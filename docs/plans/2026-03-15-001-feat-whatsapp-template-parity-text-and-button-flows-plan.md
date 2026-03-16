---
title: "feat: WhatsApp template parity — make templates work for both text and button input"
type: feat
status: completed
date: 2026-03-15
origin: docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md
---

# feat: WhatsApp template parity — text and button flows

## Overview

Make Twilio Content Templates fire for **both** typed text and button clicks. Currently, templates only work through the button-driven chain (welcome → browse button → category picker → product picker → qty → confirm). When users type equivalent text ("Ce aveti?", "Carne", "1"), they get plain text LLM responses instead of templates.

This is the #1 UX gap in the WhatsApp ordering system post-GA hardening merge.

## Problem Statement / Motivation

Real conversation from production (2026-03-15):
- User clicked "🔍 Caut un produs" button on welcome template → **NO RESPONSE** (browse button silently ignored)
- User typed "Ce aveti?" → got plain text category list (should have been category list-picker)
- User typed "Carne" → got plain text numbered product list (should have been product list-picker)
- Templates only fired for greeting (welcome) and confirmation (DA/NU buttons)

**Bug 0 — Browse button click silently ignored**: `handleButtonPayload()` checks `buttonPayload === 'browse'`, but the actual Twilio `ButtonPayload` value depends on how the welcome template is configured in the Twilio Console. If the template button sends a different payload (e.g., the button text or a different ID), the function falls through ALL checks without sending any response. There is NO catch-all/fallback for unrecognized payloads — the function exits silently.

Root cause: the webhook has two parallel, disconnected flows:

1. **Button path** (`handleButtonPayload`): calls `getDistinctCategories()` / `getProductsByCategory()` → stores `pending_selection` → sends list-picker templates
2. **Text path** (`handleRestConversation` → `runConversationTurn`): classifies intent → sends everything to LLM → plain text replies. Only `product_query` with 2-10 candidates has a list-picker gate, and `browse_inventory` bypasses it entirely.

The brainstorm (see brainstorm: `docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md`) chose Approach A: **"freeform first, templates guide the rest, deterministic transactional core."** This plan implements that vision.

## Proposed Solution

Fix the broken browse button, then intercept template-eligible intents **before** they reach the LLM path.

### 0. Fix browse button payload mismatch

`handleButtonPayload()` hardcodes `buttonPayload === 'browse'` but the actual Twilio template button may send a different value. Fix:
- Log ALL incoming `ButtonPayload` values for debugging
- Add catch-all fallback at end of `handleButtonPayload()` for unrecognized payloads (log + send "Nu am înțeles selecția")
- Verify the welcome template's button payload values in Twilio Console match the code expectations ('browse', 'previous', 'info')
- If they don't match, either update the template or update the code

Three new interception points in the text flow:

### 1. `browse_inventory` → category list-picker

When `classifyIncomingText` returns `browse_inventory` (e.g., "Ce aveti?", "lista", "produse"):
- Fetch categories via `getDistinctCategories()`
- Store `pending_selection` with `selection_type: 'category_list'`
- Send category list-picker template (or numbered text fallback)
- Skip LLM entirely

### 2. Category-name text → product list-picker

When `classifyIncomingText` returns `product_query` and text matches a known category name:
- Fetch products via `getProductsByCategory()`
- Store `pending_selection` with `selection_type: 'product_list'`
- Send product list-picker template (or numbered text fallback)
- Skip LLM

### 3. Numeric text → resolve against `pending_selection`

When user types "1", "2", etc. and `pending_selection` exists (not expired):
- Read `pending_selection` from DB
- Resolve index → delegate to same logic as `handleButtonPayload("product_N")`
- Reuse extracted shared helper, not duplicated code

### Architecture: Extract shared selection resolver

Extract `handleButtonPayload`'s `product_N` resolution logic into a shared function:

```typescript
// lib/whatsapp/selection-resolver.ts
async function resolveSelectionByIndex(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  index: number;  // 0-based
}): Promise<'category_selected' | 'product_selected' | 'no_context'>
```

Both `handleButtonPayload` and the text path call this. No code duplication.

## Technical Considerations

### State management

- `pending_selection` must be written by **both** text and button flows
- Add `created_at` timestamp to pending_selection payload; expire after 30 minutes
- Clear `pending_selection` on order confirmation/cancellation (prevents stale state resurrection)
- Text fallback (no SID) must ALSO store `pending_selection` so numeric input works without templates

### History synchronization

- Button flow currently does NOT append to conversation history
- After template sends (category picker, product picker), append synthetic history entries so LLM has context for subsequent text input
- Example: `{ role: 'assistant', content: 'Categorii disponibile: Lactate, Carne, Legume...' }`

### Category limits

- `getDistinctCategories()` can return 20+ items; list-picker template supports ~10 max
- Cap at 10 items (matching template variable slots `product_1` through `product_10`)
- Product list already capped at 6 in `getProductsByCategory()`

### Guardrails preservation (see brainstorm)

- Current-turn evidence still required for orders — this plan does NOT change order creation logic
- `pending_selection` is selection state, NOT transactional state — different from `pending_order`
- Chat state guardrails from CLAUDE.md remain intact
- Dedup, rate limiting, atomic order confirmation unchanged

## System-Wide Impact

- **Interaction graph**: Text input → `classifyIncomingText()` → new interception in `handleRestConversation()` → shared selection resolver → `storePendingProductSelection()` → template send. Subsequent button clicks from templates continue through existing `handleButtonPayload()` path unchanged.
- **Error propagation**: Template send failures already have graceful fallback (plain text). New text interceptions use same `try/catch → sendRestMessage fallback` pattern.
- **State lifecycle risks**: `pending_selection` without TTL could produce stale selections. Fixed by adding `created_at` + 30min expiry.
- **API surface parity**: Simulator (`lib/whatsapp/simulator.ts`) uses `runConversationTurn()` — if browse interception moves to webhook.ts, simulator won't see it. Must decide: intercept in `runConversationTurn()` (shared) or `webhook.ts` (webhook-only).
- **Integration test scenarios**: Text "Ce aveti?" → category picker → click product_1 → product picker (cross-boundary: text triggers template, template triggers button handler).

## Acceptance Criteria

### Functional

- [x] Welcome template browse button click triggers category list-picker (fix payload mismatch)
- [x] `handleButtonPayload()` has catch-all fallback for unrecognized payloads (no more silent failures)
- [x] Text "Ce aveti?" / "lista" / "produse" → sends category list-picker template (if SID set) or numbered text list (if not)
- [x] Text matching a category name (e.g., "Carne") → sends product list-picker for that category
- [x] Text "1" / "2" / etc. with active `pending_selection` → resolves to the selected category or product
- [x] Text "1" with NO `pending_selection` → falls through to LLM (no crash, no error)
- [x] Text flow stores `pending_selection` at each step (category_list, product_list, awaiting_qty)
- [x] Text fallback (no SID) also stores `pending_selection` for numeric resolution
- [x] Category list capped at 10 items
- [x] `pending_selection` cleared on order confirmation and cancellation
- [x] `pending_selection` expires after 30 minutes (stale input does not resolve)
- [x] Synthetic history entries appended after template sends (context for LLM)
- [x] Existing button flow unchanged and passing
- [x] Existing order lifecycle (dedup, rate limit, atomic confirm) unchanged

### Non-Functional

- [x] All 4 template SIDs remain optional — full plain text fallback works
- [x] `pnpm typecheck` passes
- [x] `pnpm vitest run tests/unit/whatsappAgent.test.ts tests/integration/whatsapp-agent.test.ts` passes
- [x] New tests cover text→template parity for browse, category, and numeric flows

## Implementation Phases

### Phase 0: Fix browse button + add catch-all fallback (~30 LOC)

Diagnose and fix the broken browse button:
- Add debug logging for ALL incoming `ButtonPayload` values at top of `handleButtonPayload()`
- Add catch-all at END of `handleButtonPayload()` for unrecognized payloads: log warning + send fallback message
- Verify Twilio welcome template button payload values match code expectations
- If mismatch: update the code to accept the actual payload value (or add alias)

Files:
- `lib/whatsapp/webhook.ts` (handleButtonPayload — add logging + catch-all)

**This is the quickest win — fixes the button flow before tackling text flow parity.**

### Phase 1: Extract shared selection resolver (~100 LOC)

Create `lib/whatsapp/selection-resolver.ts`:
- Extract `product_N` resolution logic from `handleButtonPayload()`
- Shared by both button and text paths
- Handles: category_list → fetch products → send picker, product_list → send qty, awaiting_qty → noop, no_context → fallback

Files:
- `lib/whatsapp/selection-resolver.ts` (new)
- `lib/whatsapp/webhook.ts` (refactor `handleButtonPayload` to use shared resolver)

### Phase 2: Browse inventory interception (~80 LOC)

Add `browse_inventory` interception in text flow:
- In `handleRestConversation()` or `runConversationTurn()`, detect `browse_inventory` intent
- Call `getDistinctCategories()`, cap at 10
- Store `pending_selection` with `selection_type: 'category_list'`
- Send category list-picker or numbered text fallback
- Append synthetic history entry

Files:
- `lib/whatsapp/webhook.ts` or `lib/whatsapp/llm.ts`
- `lib/whatsapp/inventory.ts` (cap categories)

### Phase 3: Category-name detection (~60 LOC)

For `product_query` intent, check category match before LLM:
- Fetch categories, normalize + compare against user text
- If match: `getProductsByCategory()` → store `pending_selection` → send product picker
- If no match: fall through to existing product_query / LLM path

Files:
- `lib/whatsapp/llm.ts` or `lib/whatsapp/webhook.ts`
- `lib/whatsapp/inventory.ts` (add `findMatchingCategory()`)

### Phase 4: Numeric text resolution (~50 LOC)

Before LLM call, check for numeric input + active pending_selection:
- `parseMenuChoice(text)` returns number
- `getPendingProductSelection()` returns selection state
- Check TTL (30 min)
- Delegate to shared selection resolver

Files:
- `lib/whatsapp/webhook.ts`
- `lib/whatsapp/conversation-state.ts` (add TTL check, add `created_at` to payload)

### Phase 5: State lifecycle fixes (~30 LOC)

- Add `created_at` to `pending_selection` payloads
- Clear `pending_selection` on confirm/cancel
- Text fallback (no SID) stores `pending_selection`
- Append history entries from button/template flows

Files:
- `lib/whatsapp/conversation-state.ts`
- `lib/whatsapp/webhook.ts` (confirm/cancel handlers, text fallback)

### Phase 6: Tests (~150 LOC)

New test file: `tests/unit/lib/whatsapp-selection-resolver.test.ts`
Additional cases in: `tests/unit/whatsappAgent.test.ts`, `tests/integration/whatsapp-agent.test.ts`

Scenarios:
- Text "Ce aveti?" → category list-picker returned
- Text "Carne" matching category → product list-picker returned
- Text "1" with category_list pending → resolves to first category
- Text "1" with product_list pending → resolves to first product
- Text "1" with no pending → falls through to LLM
- Text "1" with expired pending (>30 min) → falls through to LLM
- Text "Ce aveti?" while awaiting_qty → resets selection state
- Full journey: text browse → click category → click product → text qty → confirm

## Dependencies & Risks

### Dependencies
- All 4 Twilio Content Template SIDs must be created in Twilio Console (already exist per user's testing)
- Existing `pending_selection` column in `conversation_history` table (already exists)
- No DB migrations needed

### Risks
- **Category matching ambiguity**: "Carne" could match both a category AND a product name. Mitigation: category match takes priority; if user meant a specific product, they'll see it in the category's product list anyway.
- **State collision**: Text and button paths writing to same `pending_selection` simultaneously. Mitigation: MessageSid dedup prevents exact duplicates; for different concurrent messages, last-write-wins is acceptable (both are valid user actions).
- **Simulator parity**: If interception moves to `webhook.ts`, the simulator (which calls `runConversationTurn` directly) won't get template behavior. Mitigation: add browse + category interception in `runConversationTurn` so both paths benefit.
- **PR size**: ~470 LOC estimated across 6 phases. Within 600 LOC limit.

## Success Metrics

- Real WhatsApp conversation shows list-picker templates for browse, category, and product selection (not plain text)
- Full order journey works via text-only input: "Ce aveti?" → category picker → type "1" → product picker → type "2" → qty/pickup → confirm
- Mixed input works: text triggers template, user clicks template button → flow continues
- No regression in existing button-only flow or order lifecycle

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-11-whatsapp-template-led-assistant-brainstorm.md) — Key decisions: Approach A (freeform first, templates guide the rest), treat confirm/cancel/disambiguation as template-driven states, shrink orchestration complexity.
- **Replay brainstorm:** [docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md)
- **Prompt hardening plan:** [docs/plans/2026-03-13-fix-whatsapp-prompt-hardening-and-orchestration-tests-plan.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-13-fix-whatsapp-prompt-hardening-and-orchestration-tests-plan.md)
- **GA hardening solution:** [docs/solutions/logic-errors/whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md)
- **Stale history solution:** [docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md)
- **Post-merge stability gaps:** memory file `post_merge_stability_gaps.md`
- **Spec:** [docs/specs/whatsapp_agent.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md)

### Key files to modify

| File | Change |
|------|--------|
| `lib/whatsapp/selection-resolver.ts` | NEW — shared selection resolution logic |
| `lib/whatsapp/webhook.ts` | Refactor handleButtonPayload, add text interceptions |
| `lib/whatsapp/llm.ts` | Add browse_inventory + category match in runConversationTurn |
| `lib/whatsapp/inventory.ts` | Cap categories at 10, add findMatchingCategory() |
| `lib/whatsapp/conversation-state.ts` | Add TTL to pending_selection, add clear function |
| `lib/whatsapp/types.ts` | Optional: add categoryPicker to WhatsAppSimulatorResult |
| `tests/unit/lib/whatsapp-selection-resolver.test.ts` | NEW — selection resolver tests |
| `tests/unit/whatsappAgent.test.ts` | Add text→template parity tests |
| `tests/integration/whatsapp-agent.test.ts` | Add cross-flow journey tests |
