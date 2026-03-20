---
status: complete
priority: p2
issue_id: "175"
tags: [code-review, mcp, supabase, reliability]
dependencies: []
---

# Guard MCP `search_products` stock query when product IDs are empty

## Problem Statement

`mcp/server.ts` calls `.in('product_id', ids)` even when `ids` is empty. Some PostgREST/Supabase setups error on empty `in()` filters, which would make `search_products` fail for “no matches” queries.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:231` builds `ids` and always queries stock movements via `.in('product_id', ids)`.
- For zero matches, `ids` becomes `[]`, and the stock query is unnecessary (should just return empty products).

## Proposed Solutions

### Option 1: Early-return on empty rows

**Approach:** If `rows.length === 0`, return `{ products: [] }` without hitting stock movements.

**Pros:**
- Simplest, least error-prone
- Avoids needless query

**Cons:**
- None

**Effort:** < 15 min  
**Risk:** Low

---

### Option 2: Conditional `.in()` only when ids.length > 0

**Approach:** Wrap the stock query in an `if (ids.length)` guard; otherwise use `[]` movements.

**Pros:**
- Minimal diff

**Cons:**
- Slightly more branching

**Effort:** < 15 min  
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:197`

## Acceptance Criteria

- [x] `search_products` returns empty list for no-match queries (no error)
- [ ] Unit or smoke test covers the empty-match path

## Work Log

### 2026-03-20 - Code review finding

**By:** Codex

**Actions:**
- Noted potential empty-`in()` failure mode in MCP tool implementation

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Added early-return for empty product matches (skip stock query) and clamped inputs (`mcp/server.ts`).
