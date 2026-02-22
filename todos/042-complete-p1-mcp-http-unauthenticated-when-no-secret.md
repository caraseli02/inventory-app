---
status: pending
priority: p1
issue_id: "042"
tags: [security, mcp, authentication, code-review]
dependencies: []
---

# MCP HTTP server is fully open when MCP_SECRET is not set

## Problem Statement

The MCP HTTP server has no authentication when `MCP_SECRET` env var is absent. The `.env.example` comments it out by default. Any process with network access to port 3001 can enumerate the full inventory (products, stock levels, prices, barcodes, suppliers) with a single HTTP POST. No warning is logged at startup.

## Findings

**Location:** `mcp/main.ts:24-34`

```typescript
if (SECRET) {
  app.use('/mcp', (req, res, next) => { /* auth check */ next(); });
}
// If SECRET absent: all three routes are wide open
app.post('/mcp', ...);
app.get('/mcp', ...);
app.delete('/mcp', ...);
```

Combined with wildcard CORS (see #043), this creates a complete unauthenticated read path: any web page the user visits can POST to `http://localhost:3001/mcp` and dump the entire inventory. No credentials needed.

## Proposed Solutions

### Solution 1: Require MCP_SECRET for HTTP mode (Recommended)
Refuse to start HTTP server if `MCP_SECRET` is unset:
```typescript
if (!SECRET) {
  console.error('ERROR: MCP_SECRET must be set for HTTP transport. Exiting.');
  process.exit(1);
}
```
**Pros:** Fails fast, no silent misconfiguration. **Cons:** Requires operators to set the secret. **Effort:** Small.

### Solution 2: Log loud warning, allow insecure mode explicitly
Require `MCP_ALLOW_UNAUTHENTICATED=true` env var to explicitly opt into no-auth mode, otherwise refuse:
```typescript
if (!SECRET && !process.env.MCP_ALLOW_UNAUTHENTICATED) {
  console.error('SECURITY WARNING: Set MCP_SECRET or MCP_ALLOW_UNAUTHENTICATED=true');
  process.exit(1);
}
```
**Pros:** Explicit opt-in for local dev. **Cons:** Adds another env var. **Effort:** Small.

### Solution 3: Default to localhost-only binding
Without `MCP_SECRET`, bind to `127.0.0.1` only to limit exposure:
```typescript
app.listen(PORT, SECRET ? '0.0.0.0' : '127.0.0.1', ...);
```
**Pros:** Defense in depth. **Cons:** Doesn't fix the root issue. **Effort:** Small.

## Recommended Action

Solution 1: Fail fast when `MCP_SECRET` is absent in HTTP mode. Also update `.env.example` and `docs/MCP_SETUP.md` to make it clear this is mandatory for HTTP transport.

## Acceptance Criteria

- [ ] HTTP server refuses to start without `MCP_SECRET` set (or requires explicit opt-in)
- [ ] Clear error message at startup explains why it failed
- [ ] `.env.example` marks `MCP_SECRET` as required for HTTP mode
- [ ] `docs/MCP_SETUP.md` documents security requirements

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Security Sentinel Agent)
**Actions:** Identified critical unauthenticated access via security review of PR #116.

## Technical Details

**Affected Files:**
- `mcp/main.ts:24-34`
- `.env.example`
- `docs/MCP_SETUP.md`

## Resources

- PR #116: Add MCP server for Claude Desktop inventory integration
- Related: #043 (wildcard CORS compounds this issue)
