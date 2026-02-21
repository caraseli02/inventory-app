---
status: pending
priority: p3
issue_id: "054"
tags: [agent-native, mcp, code-review]
dependencies: ["047"]
---

# MCP tools missing category filter, low-stock filter, and stock history

## Problem Statement

Three agent-accessible capabilities that map directly to existing UI features and API functions are missing:
1. **Category filter** on `list_all_products` — UI has it, agents cannot filter by category
2. **Low-stock filter** — `LowStockAlertsPanel` exists in UI; agents can't query "show me low-stock items"
3. **get_stock_history** — `ProductDetailDialog` shows movement history; `getStockMovements` exists in `lib/api-provider.ts`

## Findings

**Agent-native parity gaps:**
- `list_all_products` has no `category` or `low_stock_only` params
- No `get_stock_history(product_id)` tool exists
- Tool descriptions don't enumerate returned fields, forcing Claude to call tools to discover their output shape

## Proposed Solutions

### Solution 1: Add optional filters + history tool
**list_all_products** additions:
```typescript
inputSchema: {
  category: z.string().optional().describe('Filter by category (e.g. "Dairy", "Produce")'),
  low_stock_only: z.boolean().optional().describe('If true, return only products at or below min stock level'),
},
// Apply in query:
if (category) query = query.eq('category', category);
// low_stock_only: filter after fetch since it requires stock calculation
```

**get_stock_history tool:**
```typescript
registerAppTool(server, 'get_stock_history', {
  title: 'Get Stock History',
  description: 'Returns recent stock movements for a product. Fields: quantity, type (IN/OUT), date, note.',
  inputSchema: {
    product_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).default(20),
  },
}, async ({ product_id, limit }) => {
  const { data } = await supabase
    .from('stock_movements')
    .select('quantity, type, date, note')
    .eq('product_id', product_id)
    .order('date', { ascending: false })
    .limit(limit);
  return { content: [{ type: 'text', text: JSON.stringify({ tool: 'get_stock_history', product_id, movements: data ?? [] }) }] };
});
```

**Effort:** Medium.

### Solution 2: Extended tool descriptions only
Update descriptions to enumerate returned fields: "Returns: id, name, barcode, category, price (EUR), supplier, minStock, currentStock." Low effort, improves Claude's tool selection without adding filters. **Effort:** Trivial.

## Recommended Action

Solution 2 immediately (description improvements), Solution 1 in a follow-up PR as agent capabilities expand.

## Acceptance Criteria

- [ ] Tool descriptions enumerate all returned fields
- [ ] `get_stock_history` tool available
- [ ] `list_all_products` accepts optional `category` filter

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Agent-Native Reviewer Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts` — tool descriptions + new tool registration
