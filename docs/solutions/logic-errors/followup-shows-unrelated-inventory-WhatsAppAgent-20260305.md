---
module: WhatsAppAgent
date: 2026-03-05
problem_type: logic_error
component: api_client
symptoms:
  - "Follow-up message returns unrelated inventory items (e.g. milk → meat)"
  - "Menu choice reply (\"1\") doesn't create an order"
root_cause: state_race
resolution_type: refactor
severity: high
tags: [whatsapp, simulator, conversation-history, order-flow, supabase, openai]
related_github_issue: null
commit: "3820ca2"
---

# Problem Description

While testing the WhatsApp order agent locally, a normal multi-turn flow would “lose” product context on follow-up turns. Example: user asks for milk, then confirms quantity + pickup time, and the agent responds with unrelated inventory (meat items) or fails to create an order.

This also made debugging painful because the only reliable way to reproduce was through WhatsApp.

# Symptoms

**Repro (local simulator or WhatsApp):**

1. `aveti lapte?` → assistant shows correct inventory lines for milk.
2. `da 2, sa ridic la 18.30` → expected: ask to choose between the milk options (or create order if exact item provided).
3. Actual: inventory context flips to unrelated items and/or order is not created.

**Observed side effects:**
- “Choice menu” flows didn’t complete: user replies `1`, but no order is inserted (missing `ORDER:{...}` or missing menu context).

# Root Cause Analysis

There were multiple compounding issues:

1) **History keyword leakage**
- `extractSearchCandidatesFromHistory()` considered assistant messages and could pull tokens like `condensat`, `ridicarea`, `integral` instead of reusing the user’s original product keyword (`lapte`).
- This caused inventory search to query with irrelevant terms, returning unrelated products.

2) **Message persistence races**
- Conversation context is stored in `conversation_history.messages`.
- Persisting context was subject to:
  - missing/late history writes (async “fire-and-forget” previously),
  - and classic lost updates from `read → append → upsert` when requests overlap.

# Solution

## 1) Keep product context anchored to user messages

- Restrict history keyword fallback to `role === 'user'` messages only.
- Add pickup-related stopwords variants (e.g. `ridicarea`) so pickup-time text doesn’t become a “product term”.

## 2) Make menu-selection deterministic

When the assistant asks:

```
1) Product A
2) Product B
```

and user replies `1`, we now create an `ORDER:{...}` payload using:
- the chosen menu option (or inventory list fallback),
- last known `{qty, pickupTime}` from prior user message.

## 3) Make conversation persistence concurrency-safe

- Added a Supabase SQL RPC function `append_conversation_history(phone, messages)` that atomically appends new message pairs and trims to last 20.
- Server uses RPC when available, with a safe fallback to upsert (for environments where the migration hasn’t been applied yet).

## 4) Prevent drift between providers (OpenAI vs Anthropic)

- Extracted a shared `runConversationTurn()` pipeline used by both:
  - simulator (OpenAI primary),
  - WhatsApp agent (Anthropic path).

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappInventory.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-sim-eval.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/whatsapp-sim-followup-eval.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/supabase/migrations/20260305153000_conversation_history_append_rpc.sql`

# Prevention

- [x] Unit tests cover: stopwords, `milk → lapte`, history fallback only uses user turns, follow-up menu selection produces `ORDER:{...}`.
- [x] Add repeatable eval: `pnpm whatsapp:eval:followup` (multi-turn: query → qty/time → choice → order exists).
- [ ] Add a small concurrency stress test (two parallel turns on same phone) to validate no lost updates (requires RPC applied).

