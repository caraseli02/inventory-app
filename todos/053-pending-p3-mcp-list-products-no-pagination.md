---
status: pending
priority: p3
issue_id: "053"
tags: [performance, mcp, code-review]
dependencies: ["047"]
---

# list_all_products has no pagination — silently truncates at 1000 products

## Problem Statement

Supabase default max page size is 1,000 rows. For inventories over 1,000 products, `list_all_products` silently returns incomplete data with no error or indication that results were truncated. Even for smaller inventories, returning everything in one shot creates a large JSON payload sent to Claude's context.

## Findings

**Location:** `mcp/server.ts:50`

```typescript
sb.from('products').select('id, name, barcode, category, price, supplier, min_stock_level')
// No .range(), no .limit()
```

## Proposed Solutions

### Solution 1: Add optional pagination params
```typescript
inputSchema: {
  page: z.number().int().min(0).default(0).describe('Page number (0-indexed)'),
  page_size: z.number().int().min(1).max(100).default(50).describe('Results per page'),
},
// In query:
.range(page * page_size, (page + 1) * page_size - 1)
```
**Effort:** Medium. Claude can page through results across multiple calls.

### Solution 2: Hard limit of 200 with count
Add `.limit(200)` and return total count so Claude knows if results are truncated. **Effort:** Small.

## Recommended Action

Solution 2 for now — simple hard limit with a count field in the response. Solution 1 when inventory grows beyond 200 products.

## Acceptance Criteria

- [ ] `list_all_products` does not return more than a reasonable limit
- [ ] Response includes total count so Claude knows if truncated
- [ ] No silent data loss

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Performance Oracle Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts:50`
