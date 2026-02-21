---
status: pending
priority: p3
issue_id: "055"
tags: [architecture, mcp, code-review]
dependencies: []
---

# VITE_ prefix on MCP server env vars is semantically wrong for Node.js

## Problem Statement

`VITE_` is a Vite-specific prefix meaning "expose this to the browser bundle via import.meta.env." Using it for a Node.js server process implies these variables flow through Vite's env injection — they don't. Operators setting these in Claude Desktop's config or server environment get `VITE_SUPABASE_URL` working but with misleading semantics. New developers will be confused about why a server env var has a browser prefix.

## Findings

**Location:** `mcp/server.ts:21-23`

```typescript
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

The PR notes acknowledge: "Server uses process.env (not import.meta.env)" — but the naming still carries false intent.

Practical benefit of fixing: operators can use a separate `.env` for the MCP server with clean names, reducing risk of accidentally copying browser-destined Vite vars into a server context (or vice versa).

## Proposed Solutions

### Solution 1: Accept both names with SUPABASE_URL as preferred
```typescript
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```
Backwards compatible for shared `.env` files, but prefers clean names. **Effort:** Trivial.

### Solution 2: Document-only fix
Add a note to `docs/MCP_SETUP.md` explaining that `VITE_SUPABASE_URL` works in the server context despite the prefix, because `process.env` doesn't filter by prefix. **Effort:** Minimal.

## Recommended Action

Solution 2 for now — the naming works, and consistency with the shared `.env` file is useful. Add a comment in `mcp/server.ts` explaining why `VITE_` is used here.

## Acceptance Criteria

- [ ] `mcp/server.ts` has a comment explaining `VITE_` prefix usage in Node.js context
- [ ] `docs/MCP_SETUP.md` clarifies env var naming

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Architecture Strategist Agent)

## Technical Details

**Affected Files:**
- `mcp/server.ts:21-23`
- `docs/MCP_SETUP.md`
