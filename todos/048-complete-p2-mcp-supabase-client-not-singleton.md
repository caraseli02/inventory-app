---
status: pending
priority: p2
issue_id: "048"
tags: [performance, mcp, supabase, code-review]
dependencies: []
---

# MCP creates new Supabase client on every tool call instead of singleton

## Problem Statement

`getSupabase()` calls `createClient(url, key)` on every invocation. `createClient` initializes internal state, auth listeners, and connection pooling resources. For the STDIO transport (long-lived process), the same MCP server handles many sequential tool calls — each pays initialization cost and discards the client. This is inconsistent with the established pattern in `src/lib/supabase.ts` which exports a module-level singleton.

## Findings

**Location:** `mcp/server.ts:20-28`

```typescript
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? ...;
  return createClient(url, key);  // new client every call
}
```

Compare with the correct pattern in `src/lib/supabase.ts`:
```typescript
export const supabase = createClient<Database>(url, key);
export default supabase;
```

Also: env var validation happens lazily inside each call. Missing vars are only discovered on first tool invocation, not at server startup.

## Proposed Solutions

### Solution 1: Module-level singleton (Recommended)
```typescript
// Validate at startup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars. Exiting.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```
**Pros:** Single init, fail-fast at startup, matches `src/lib/supabase.ts` pattern. **Effort:** Small.

## Recommended Action

Solution 1 — straightforward refactor. Do alongside #047 (query optimization).

## Acceptance Criteria

- [ ] `createClient` called once at module initialization
- [ ] Missing env vars fail at startup with clear error, not at first tool call
- [ ] Singleton exported and used by all tool handlers

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Performance Oracle Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts:20-28`
