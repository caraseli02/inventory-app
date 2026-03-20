---
status: pending
priority: p3
issue_id: "173"
tags: [code-review, whatsapp, mcp, agent-native]
dependencies: []
---

# Align `search_products` output shape across WhatsApp tool + MCP

## Problem Statement

There are now two `search_products` surfaces:
- WhatsApp LLM tool result (in `lib/whatsapp/llm.ts`)
- MCP tool `search_products` (in `mcp/server.ts`)

They return similar-but-not-identical shapes (e.g., WhatsApp includes `outOfStock`, MCP does not). This can confuse downstream agent prompting/docs and makes parity checks harder.

## Findings

- WhatsApp tool returns `{ products: [{ id, name, price, currentStock, outOfStock, ... }] }`. `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:24`
- MCP tool returns `{ products: [{ currentStock, ... }] }` (no `outOfStock` field). `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:197`
- Spec asks that out-of-stock items be clearly indicated. `/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md:77`

## Proposed Solutions

### Option 1: Add `outOfStock` boolean to MCP mapping

**Approach:** Extend `mapRow()` (or tool response) to include `outOfStock: currentStock <= 0`.

**Pros:**
- Simple, explicit for LLM consumers

**Cons:**
- Slight schema expansion for MCP clients

**Effort:** 30–60 min

**Risk:** Low

---

### Option 2: Document canonical schema + treat `outOfStock` as derived

**Approach:** Keep MCP minimal and update docs/prompting to derive `outOfStock` from `currentStock`.

**Pros:**
- No MCP payload expansion

**Cons:**
- Less ergonomic for LLMs; inconsistent outputs remain

**Effort:** 30–60 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:24`
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:197`

## Acceptance Criteria

- [ ] `search_products` outputs are documented and consistent (or intentionally derived)
- [ ] At least one test asserts out-of-stock is detectable from returned fields

## Work Log

### 2026-03-20 - Initial Discovery

**By:** Codex

**Actions:**
- Identified schema divergence between WhatsApp tool and MCP tool
