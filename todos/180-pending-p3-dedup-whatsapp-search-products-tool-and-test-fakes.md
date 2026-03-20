---
status: pending
priority: p3
issue_id: "180"
tags: [code-review, refactor, whatsapp, maintainability, tests]
dependencies: []
---

# Dedup `search_products` tool wiring + test fake Supabase helpers

## Problem Statement

The new `search_products` tool is implemented twice (Anthropic + OpenAI), and new tests duplicate fairly large fake Supabase helpers. This increases maintenance cost and makes future schema changes risky.

## Findings

- Tool definition + mapping duplicated:
  - Anthropic tool loop: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:58`
  - OpenAI tool wiring: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:474`
- `searchProducts()` and `searchProductNames()` share “try terms, prefer selective hit” logic:
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:125`
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:370`
- Fake Supabase helpers duplicated in tests:
  - `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappLlmInventoryPrompt.test.ts:30`
  - `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappSearchProducts.test.ts:22`

## Proposed Solutions

### Option 1: Extract small shared helpers (recommended)

**Approach:**
- Add `lib/whatsapp/llm-tools.ts` exporting a shared `mapSearchProductsResult()` + schema constants, used by both Anthropic + OpenAI paths.
- Add `tests/unit/helpers/fakeSupabase.ts` with `likeToRegex()` + `createFakeSupabase()` utilities and import in tests.

**Pros:** Smaller diffs later; fewer places to update.
**Cons:** Slight refactor churn.
**Effort:** 1–2 hours
**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] One canonical `search_products` result-shape mapping reused in both LLM providers
- [ ] Test fake helpers reused (no copy/paste blocks across unit tests)

## Work Log

### 2026-03-20 - Created from ce:review (simplicity pass)

**By:** Codex

**Actions:**
- Consolidated multiple DRY suggestions into a single refactor todo.

