---
status: pending
priority: p2
issue_id: "082"
tags: [code-review, agent-native, mcp, whatsapp, orders]
dependencies: []
---

# Add MCP tools for order management: list, confirm, cancel, conversation history

## Problem Statement

The WhatsApp agent introduces a complete order lifecycle (create via AI, confirm via button, cancel), but the MCP server has zero order-related tools. A store-owner agent cannot see pending orders, confirm them, or cancel them. The owner UI has full access; agents are blind. This violates agent-native parity.

## Findings

- `mcp/server.ts` — tools: `list_all_products`, `find_product_by_name`, `find_product_by_barcode`, `add_stock_movement`, `get_stock_history`. No order tools.
- `src/lib/orders-api.ts` — `getOrders`, `confirmOrder`, `cancelOrder` exist as client-side functions — not exposed to agents.
- `src/pages/OrdersPage.tsx` — owner UI shows all orders; no MCP equivalent.
- `conversation_history` table is readable from Supabase but no MCP tool exists to query it.
- `api/whatsapp-notify.ts` — proactive notification requires a browser Supabase session; no agent path.
- 5 of 10 order-management capabilities are agent-accessible (product reads + stock movement only).

## Proposed Solutions

### Option 1: Add 4 tools to `mcp/server.ts` (Recommended)

**`list_orders`** — inputs: optional `status` (`pending|confirmed|cancelled|completed`), optional `limit` (default 20). Output: orders array.

**`confirm_order`** — input: `order_id`. Logic: `.update({ status: 'confirmed' }).eq('id', id).eq('status', 'pending')` + insert stock movement for each item. Mirror `orders-api.ts:confirmOrder` optimistic-lock pattern.

**`cancel_order`** — input: `order_id`. Logic: `.update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')`.

**`get_conversation_history`** — inputs: `phone`, optional `limit` (default 20). Output: messages array from `conversation_history`.

**Pros:** Complete agent parity for order operations; mirrors existing MCP tool style.
**Cons:** Adds ~100 LOC to `mcp/server.ts`.
**Effort:** Medium
**Risk:** Low

---

### Option 2: Minimal — `list_orders` only

**Approach:** Add only `list_orders` now; other tools in follow-up PR.

**Pros:** Faster to ship; read-only is safer.
**Cons:** Agent can see orders but can't act on them.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `mcp/server.ts` — add 4 new tool definitions
- Reference: `src/lib/orders-api.ts` — confirm/cancel logic to mirror

## Acceptance Criteria

- [ ] `list_orders` MCP tool returns orders filtered by status
- [ ] `confirm_order` tool transitions status and deducts stock (mirrors `orders-api.ts`)
- [ ] `cancel_order` tool transitions status with pending-only guard
- [ ] `get_conversation_history` tool returns messages for a given phone
- [ ] All tools appear in MCP tool list
- [ ] `pnpm mcp:typecheck` passes

## Work Log

### 2026-03-10 — Found by agent-native-reviewer

## Resources

- **PR:** #156
- **Reference:** `src/lib/orders-api.ts`, `mcp/server.ts`
