---
status: pending
priority: p3
issue_id: "051"
tags: [security, performance, mcp, code-review]
dependencies: ["042", "047"]
---

# MCP HTTP server has no rate limiting — DoS via tool invocation

## Problem Statement

No rate limiting on any MCP route. `find_product_by_name` fetches ALL products + ALL movements on every call. An attacker can send rapid-fire POST requests to exhaust Supabase row-read quota and cause memory/CPU pressure. The free Supabase tier has strict row limits. Input is also unbounded (no max length on search `name`).

## Findings

**Location:** `mcp/main.ts` (entire file), `mcp/server.ts:113`

```typescript
name: z.string().describe('...')  // no max length
```

Note: If #047 (product_stock view) is implemented, the DoS vector is significantly reduced. Rate limiting remains best practice regardless.

## Proposed Solutions

### Solution 1: Add express-rate-limit + input bounds (Recommended)
```typescript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ windowMs: 60_000, max: 60, message: { error: 'Too many requests' } });
app.use('/mcp', limiter);

// In schema:
name: z.string().min(1).max(200).describe('Search term (max 200 chars)')
```
**Effort:** Small. **New dep:** `express-rate-limit`.

### Solution 2: Input validation only (minimal effort)
Add `.min(1).max(200)` to the name schema without rate limiting. Reduces the per-request cost amplification. **Effort:** Trivial.

## Recommended Action

Solution 2 (input bounds) immediately; Solution 1 (full rate limiting) if the server is ever network-exposed. Note: #042 (require auth) is the more important fix — authenticated endpoints have a much smaller DoS surface.

## Acceptance Criteria

- [ ] Search input has `max(200)` constraint
- [ ] Rate limiting in place for HTTP transport (optional for localhost-only use)

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Security Sentinel Agent)

## Technical Details

**Affected Files:**
- `mcp/main.ts`
- `mcp/server.ts:113`
