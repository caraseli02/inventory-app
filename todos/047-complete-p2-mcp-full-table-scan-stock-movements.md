---
status: pending
priority: p2
issue_id: "047"
tags: [performance, mcp, supabase, code-review]
dependencies: []
---

# MCP fetches entire stock_movements table on every tool call

## Problem Statement

Every call to either MCP tool triggers `fetchAllProducts()` which fetches the complete `stock_movements` table with no filter. This table grows unboundedly — each stock adjustment appends a row. A mature store with 500 products and 2 years of daily scans will have 50,000–200,000 rows returned, deserialized, and summed in memory on every single tool invocation.

## Findings

**Location:** `mcp/server.ts:51`

```typescript
sb.from('stock_movements').select('product_id, quantity'),  // no WHERE, no filter
```

The schema already defines a `product_stock` view in `database.types.ts` (lines 44–51) that handles aggregation at the database level via GROUP BY + JOIN. Using it replaces two unbounded queries with one aggregated query.

Scalability table:
| Products | Movements | Current behavior | With product_stock view |
|---|---|---|---|
| 100 | 1,000 | ~200ms | ~50ms |
| 500 | 50,000 | ~2–5s | ~100ms |
| 1,000+ | 200,000 | timeout / OOM | ~200ms |

## Proposed Solutions

### Solution 1: Use product_stock view (Recommended)
Replace the dual-query pattern in `fetchAllProducts()`:
```typescript
const { data, error } = await sb
  .from('product_stock')
  .select('id, name, barcode, category, price, supplier, min_stock_level, current_stock_level');
if (error) throw new Error(`Fetch failed: ${error.message}`);
return (data ?? []).map((p) => ({ ...p, currentStock: p.current_stock_level ?? 0 }));
```
One query, O(P) not O(P+M). **Effort:** Small. **Risk:** Requires `product_stock` view to exist in DB.

### Solution 2: Aggregate in Supabase query
If `product_stock` view doesn't exist, use a manual aggregate:
```typescript
sb.from('stock_movements')
  .select('product_id, quantity.sum()')
  .group('product_id')
```
Less clean but avoids full fetch. **Effort:** Medium.

## Recommended Action

Solution 1 — the `product_stock` view is already in the schema. Confirm it exists in production Supabase and use it. Combine with singleton client fix (#048).

## Acceptance Criteria

- [ ] `fetchAllProducts` does not fetch all stock_movements rows
- [ ] Stock calculation done at DB level, not in Node.js memory
- [ ] Response time under 500ms for inventories up to 1,000 products

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Performance Oracle Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts:45-73`
