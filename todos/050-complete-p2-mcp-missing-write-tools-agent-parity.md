---
status: pending
priority: p2
issue_id: "050"
tags: [agent-native, mcp, code-review]
dependencies: []
---

# MCP server is read-only — agents cannot perform stock movements (agent-native gap)

## Problem Statement

The MCP server covers 2 of 10 user-facing capability categories (read-only). The highest-frequency user action — recording a stock movement (IN/OUT) — is not accessible to agents. An agent asked "add 10 units of milk to stock" must instruct the user to do it manually. This is the opposite of agent-native design.

Agent-native parity score: 2/10 capabilities covered, 0/6 write operations accessible.

## Findings

**Location:** `mcp/server.ts` — no write tools registered

Most critical missing tools:
1. `add_stock_movement(product_id, quantity, type: 'IN'|'OUT')` — highest frequency action, maps directly to `addStockMovement` in `lib/api-provider.ts`
2. `find_product_by_barcode` — covered in #049
3. `get_stock_history(product_id)` — maps to `getStockMovements` in `lib/api-provider.ts`

Lower priority (can defer):
- `create_product` — less frequent, carries risk
- `update_product` — less frequent, carries risk
- `list_all_products` with `category`/`low_stock_only` filters — covered in #054

## Proposed Solutions

### Solution 1: Add add_stock_movement as minimum viable write tool (Recommended)
```typescript
registerAppTool(server, 'add_stock_movement', {
  title: 'Add Stock Movement',
  description: 'Record a stock IN or OUT movement for a product. Use this to update inventory levels.',
  inputSchema: {
    product_id: z.string().uuid().describe('Product ID (from list_all_products or find_product_by_name)'),
    quantity: z.number().int().positive().describe('Quantity to add or remove (always positive)'),
    type: z.enum(['IN', 'OUT']).describe('IN to add stock, OUT to remove stock'),
    note: z.string().max(500).optional().describe('Optional note for this movement'),
  },
}, async ({ product_id, quantity, type, note }) => {
  const signedQty = type === 'OUT' ? -quantity : quantity;
  const { error } = await supabase
    .from('stock_movements')
    .insert({ product_id, quantity: signedQty, type, note, date: new Date().toISOString() });
  if (error) throw new Error(`Stock movement failed: ${error.message}`);
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, product_id, quantity, type }) }] };
});
```
**Effort:** Small. **Risk:** Write operation — should log movements for audit.

### Solution 2: Full write parity (create/update/delete product)
Add `create_product`, `update_product`, `delete_product`. **Effort:** Large. **Risk:** High — irreversible operations. Defer to v2.

## Recommended Action

Solution 1 — `add_stock_movement` is the single highest-value write tool. Low risk (append-only, matches existing app behavior). Defer `create_product`/`update_product`/`delete_product` to a follow-up PR.

## Acceptance Criteria

- [ ] `add_stock_movement` tool registered
- [ ] Accepts product_id, quantity, type (IN|OUT), optional note
- [ ] Correctly signs quantity (negative for OUT)
- [ ] Returns success/failure in structured format
- [ ] Errors surface clearly to Claude (not silent failures)

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Agent-Native Reviewer Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts` — add tool registration
