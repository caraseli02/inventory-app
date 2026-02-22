---
status: pending
priority: p1
issue_id: "043"
tags: [security, mcp, cors, code-review]
dependencies: []
---

# MCP HTTP server has wildcard CORS — any web page can access it

## Problem Statement

`app.use(cors())` with no options sets `Access-Control-Allow-Origin: *`. Any website the user visits can make cross-origin requests to `http://localhost:3001/mcp` from the browser and read the full inventory. Combined with missing auth (#042), this is a complete cross-origin data exfiltration path requiring zero credentials.

## Findings

**Location:** `mcp/main.ts:21`

```typescript
app.use(cors()); // Access-Control-Allow-Origin: *
```

Simple requests (GET/POST with standard headers) bypass preflight entirely. Even if `MCP_SECRET` is set, wildcard CORS leaks information about whether the endpoint exists and allows credential-guessing attacks. The intended client (Claude Desktop) uses STDIO, not HTTP cross-origin requests.

## Proposed Solutions

### Solution 1: Restrict to Claude.ai origin (Recommended)
```typescript
app.use(cors({ origin: ['https://claude.ai', 'https://claude.anthropic.com'] }));
```
**Pros:** Matches the actual intended consumer. **Cons:** Must be updated if Claude.ai changes domains. **Effort:** Trivial.

### Solution 2: Configurable allowlist via env var
```typescript
const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN?.split(',') ?? ['https://claude.ai'];
app.use(cors({ origin: CORS_ORIGIN }));
```
**Pros:** Flexible for different deployments. **Effort:** Small.

### Solution 3: No-CORS for localhost-only deployments
For local-only MCP servers, disable CORS entirely (browser same-origin policy protects localhost):
Omit `cors()` or set `origin: false`. Suitable only when `MCP_PORT` binds to localhost.

## Recommended Action

Solution 1: Default to `['https://claude.ai']` and document in `docs/MCP_SETUP.md` how to add custom origins for self-hosted deployments.

## Acceptance Criteria

- [ ] `cors()` is replaced with an explicit origin allowlist
- [ ] Default allowlist includes `https://claude.ai`
- [ ] Wildcard `*` is never used
- [ ] Documentation updated

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Security Sentinel Agent)
**Actions:** Identified CORS misconfiguration in PR #116 security review.

## Technical Details

**Affected Files:**
- `mcp/main.ts:21`

## Resources

- PR #116: Add MCP server for Claude Desktop inventory integration
- Related: #042 (unauthenticated access compounds this)
