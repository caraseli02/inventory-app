---
status: complete
priority: p1
issue_id: "168"
tags: [code-review, security, whatsapp, mcp, performance]
dependencies: []
---

# Validate `search_products` tool inputs (NaN/abuse hardening)

## Problem Statement

`search_products` inputs are parsed from model/tool payloads. Today, invalid numeric inputs (ex: `limit: NaN`) can bypass caps and return far more rows than intended, increasing data exposure + token burn + DB load.

## Findings

- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:102` parses `limit` via `Number(input.limit)` with no `Number.isFinite` guard.
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:129` computes `limit` with `Math.floor(args.limit ?? 10)`; if `args.limit` is `NaN`, the final `limit` becomes `NaN`, disabling break conditions (dedupe loop can include all candidates).
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:222` treats `limit` as a number if `typeof limit === "number"`; `NaN` passes and can propagate to `.limit(max)`.
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:232` calls `.in('product_id', ids)` even when `ids` is empty; some Supabase backends error on empty `IN ()` lists.

Impact:
- Potential “inventory enumeration” and higher token costs (model can be induced to call tool repeatedly with large/invalid limits).
- Extra DB load (wider `ilike` matches + larger result sets).

## Proposed Solutions

### Option 1: Defensive parsing at all boundaries (recommended)

**Approach:**
- In `llm.ts`, coerce `limit` to `undefined` unless `Number.isFinite(limit)` and within `[1..25]`.
- In `inventory.ts`, treat non-finite `args.limit` as `undefined` (fallback to 10).
- In `mcp/server.ts`, clamp `limit` with `Number.isFinite` + bounds (and default to 10).

**Pros:**
- Fixes root cause at boundaries.
- Prevents accidental regressions if future callers bypass schema validation.

**Cons:**
- Small amount of duplicated validation.

**Effort:** Small

**Risk:** Low

---

### Option 2: Centralize validation helper

**Approach:** Add a `clampLimit()` helper in shared module and use it everywhere.

**Pros:** No duplication.

**Cons:** Slightly more indirection.

**Effort:** Small

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts:98`
- `/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/inventory.ts:125`
- `/Users/vladislavcaraseli/Documents/inventory-app/mcp/server.ts:197`

## Acceptance Criteria

- [x] `limit` is ignored unless finite integer.
- [x] `limit` is clamped (WhatsApp: max 25; MCP: max 50).
- [x] Unit test added covering `limit: NaN` and `limit: "999999"` payloads.

## Work Log

### 2026-03-20 - Created from security review

**By:** Codex

**Actions:**
- Identified NaN propagation paths in `search_products` tool handlers and inventory helper.

### 2026-03-20 - Fixed

**By:** Codex

**Actions:**
- Added query sanitization + finite clamp for tool inputs (`lib/whatsapp/llm.ts`).
- Added shared clamp + query sanitization inside search helpers (`lib/whatsapp/inventory.ts`).
- Clamped + early-returned MCP `search_products` for empty results (`mcp/server.ts`).
- Added unit coverage for NaN + huge limit (`tests/unit/whatsappSearchProducts.test.ts`).
