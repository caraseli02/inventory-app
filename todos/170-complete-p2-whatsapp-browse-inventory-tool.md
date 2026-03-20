---
status: complete
priority: p2
issue_id: "170"
tags: [code-review, whatsapp, mcp, agent-native]
dependencies: []
---

# WhatsApp browse inventory needs a list tool (agent-native parity)

## Problem Statement

For non-local LLM providers we no longer inject `INVENTAR LIVE` into the system prompt. The prompt now instructs the model to use `search_products`, but `browse_inventory` (“ce aveți / listă / inventar”) has no good tool primitive to call (it needs a list/categories tool, not a query search).

Result: “browse inventory” can regress or become awkward (model might call `search_products("inventar")` and return nothing / noisy results).

## Findings

- `runConversationTurn()` sets `inventoryText` to `''` for non-local providers. `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:217`
- System prompt requires calling `search_products` for product/stock/price. `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts:29`
- Spec explicitly supports browse intent + MCP tools. `/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md:77`
- MCP server already has richer listing primitives (`list_all_products`) but WhatsApp LLM toolset only includes `search_products`. `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:86`

## Proposed Solutions

### Option 1: Add a `list_products` / `browse_inventory` tool (recommended)

**Approach:** Add an LLM tool that returns a small, bounded preview:
- either category summary + 3–5 items/category, or
- top N in-stock items (N capped).

**Pros:**
- Matches user intent (“show me what you have”)
- Keeps prompt small + tool outputs bounded

**Cons:**
- Adds a second tool to maintain + document

**Effort:** 2–4 hours

**Risk:** Low

---

### Option 2: Special-case browse intent to inject a tiny server-generated preview

**Approach:** For `intent === "browse_inventory"` only, inject a compact preview (already exists in `getInventorySummary`) into the system prompt while keeping other intents tool-only.

**Pros:**
- Minimal new surface area
- Avoids extra tool wiring

**Cons:**
- Reintroduces prompt growth for browse intent

**Effort:** 1–2 hours

**Risk:** Low

---

### Option 3: Reuse MCP `list_all_products` via an internal bridge

**Approach:** Expose a WhatsApp LLM tool that internally calls the same listing logic as MCP’s `list_all_products`.

**Pros:**
- Single source of truth for listing behavior

**Cons:**
- Slightly more refactor / shared-module work

**Effort:** 4–6 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:217` (provider inventory gating)
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/prompts.ts:29` (tool expectations)
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:86` (existing list tool)

## Resources

- Spec: `/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md:77`

## Acceptance Criteria

- [x] “Ce aveți?” returns a short, useful preview without requiring a product keyword
- [x] Tool output is bounded (hard cap) to avoid token blowups
- [ ] Unit test covers browse intent path for non-local providers

## Work Log

### 2026-03-20 - Initial Discovery

**By:** Codex

**Actions:**
- Noted browse intent gap after switching to tool-first prompts
- Identified existing MCP listing primitive (`list_all_products`) for reuse

**Learnings:**
- `search_products` alone is insufficient for “browse” UX

### 2026-03-20 - Fixed (Option 2)

**By:** Codex

**Actions:**
- Special-cased `intent === "browse_inventory"` to include a bounded preview via `getInventorySummary()` for all providers (`lib/whatsapp/llm.ts`).
