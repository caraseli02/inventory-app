---
status: pending
priority: p2
issue_id: "049"
tags: [agent-native, mcp, code-review]
dependencies: []
---

# MCP missing find_product_by_barcode — primary app workflow inaccessible to agents

## Problem Statement

The primary inventory workflow is scan-barcode → lookup product. `getProductByBarcode` exists in `lib/api-provider.ts` and is called from `ScanPage.tsx`, `InventoryListPage.tsx`, and `InventoryFilters.tsx`. An agent asked "what is barcode 5901234123457?" has no tool to answer this. `find_product_by_name` does not match barcodes. The agent's lookup capability is weaker than the UI search field (which matches both name and barcode).

## Findings

**Location:** `mcp/server.ts` — tool not registered

UI search (`InventoryFilters.tsx:77`) searches "by name or barcode" in one field. MCP has name-only search. Barcode is the most precise product identifier and the most common lookup in real workflows.

## Proposed Solutions

### Solution 1: Add find_product_by_barcode tool (Recommended)
```typescript
registerAppTool(server, 'find_product_by_barcode', {
  title: 'Find Product by Barcode',
  description: 'Look up an inventory product by exact barcode. Returns: id, name, category, price (EUR), supplier, minStock, currentStock.',
  inputSchema: { barcode: z.string().min(1).max(100).describe('Exact barcode string') },
  _meta: { ui: { resourceUri: PRODUCT_CARD_URI } },
}, async ({ barcode }) => {
  const { data } = await supabase
    .from('product_stock')
    .select('...')
    .eq('barcode', barcode)
    .maybeSingle();
  return { content: [{ type: 'text', text: JSON.stringify({ tool: 'find_product_by_barcode', products: data ? [data] : [] }) }] };
});
```
**Effort:** Small. Requires #047 (product_stock view) for efficiency.

### Solution 2: Extend find_product_by_name to also match barcodes
Rename to `find_product` and match both `name ilike %term%` OR `barcode = term`. **Pros:** Single tool, matches UI behavior. **Cons:** Breaks existing tool name. **Effort:** Small.

## Recommended Action

Solution 1 — separate tool is cleaner for Claude's tool selection. Add as a new tool alongside existing ones.

## Acceptance Criteria

- [ ] `find_product_by_barcode` tool registered on MCP server
- [ ] Returns same product shape as `find_product_by_name`
- [ ] Exact barcode match (not substring)
- [ ] Returns empty array (not error) for unknown barcode

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Agent-Native Reviewer Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts` — add new tool registration
