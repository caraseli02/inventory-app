---
module: WhatsAppAgent
date: 2026-03-20
problem_type: performance_issue
component: server_component
symptoms:
  - "WhatsApp replies slow down as inventory grows"
  - "High token usage from injecting INVENTAR LIVE on every message"
  - "Risk of context-limit failures at scale"
root_cause: logic_error
resolution_type: refactor
severity: high
tags: [whatsapp-agent, inventory, prompt-bloat, tool-first, search-products, token-cost, performance]
related_github_issue: 126
commit: null
---

# Problem Description

The WhatsApp agent was building an `INVENTAR LIVE` block by fetching up to ~200 products and their stock movements on every incoming message, then injecting the full list into the LLM system prompt. This scaled poorly (latency + token costs + context limits).

# Symptoms

- Slower WhatsApp replies as the store adds products.
- Higher per-message token usage (inventory list included every turn).
- Increased chance of hitting context limits as inventory grows.

# Root Cause Analysis

Inventory access was implemented as **eager prompt injection** instead of **lazy lookup**:

- `getInventorySummary()` ran on most turns and produced a large prompt string.
- The model was expected to answer from the prompt, which couples correctness + cost to prompt size.

Additionally, some follow-up paths could re-introduce unnecessary DB work or rely on prompt text shape (local simulator parsing inventory out of the system prompt).

# Solution

## 1) Tool-first inventory: `search_products`

Instead of injecting the full inventory, the system prompt now instructs the LLM to call a tool to fetch only what it needs:

- WhatsApp LLM tool wiring: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- Prompt rule update: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts`
- Inventory search implementation: `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts`
- MCP alias for spec parity: `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts`

## 2) Keep prompts small by default

- For hosted providers (OpenAI/Anthropic), we do **not** inject `INVENTAR LIVE` for normal product queries.
- For `browse_inventory`, we still include a **bounded preview** (server-generated) to satisfy “Ce aveți?” UX without requiring a product keyword.

Implementation: `shouldIncludeInventory` gating in `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`.

## 3) Hardening + safety fixes

- Sanitize tool queries (strip `%/_`, clamp length, trim) and clamp limits to avoid NaN / abuse paths:
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts`
  - `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts`
- Anthropic tool loop now emits a `tool_result` for every `tool_use` (unknown tools return `is_error`) to avoid deadlocks:
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- Avoid wasted DB work in repair-order path:
  - Skip repair entirely when reply already contains `ORDER:`
  - Only fetch inventory for repair when the user message has qty + time and looks like an order request
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- Disambiguation list-picker continuity:
  - When returning `listPicker`, persist the numbered options to history so a follow-up `1` can be resolved deterministically
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- Prevent creating `ORDER:` from assistant-only product context:
  - Require explicit mention/selection when only assistant context is available
  - `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts`

# Files Changed

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappLlmInventoryPrompt.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappSearchProducts.test.ts`
- `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts`

# Prevention

- [x] Unit test: hosted providers do not inject `INVENTAR LIVE` and list-picker options persist to history:
  - `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappLlmInventoryPrompt.test.ts`
- [x] Unit test: `searchProducts()` clamps invalid and huge limits:
  - `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappSearchProducts.test.ts`
- [x] Unit test: follow-up does not create `ORDER:` from assistant-only context:
  - `/Users/vladislavcaraseli/Documents/inventory-app/tests/unit/whatsappAgent.test.ts`

Recommended regression commands:

```bash
pnpm test:unit
pnpm test:integration -- tests/integration/whatsapp-agent.test.ts
```

