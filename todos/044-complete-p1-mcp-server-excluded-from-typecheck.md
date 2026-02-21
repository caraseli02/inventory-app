---
status: pending
priority: p1
issue_id: "044"
tags: [typescript, mcp, ci, code-review]
dependencies: []
---

# MCP server code excluded from typecheck — type errors bypass CI

## Problem Statement

`mcp/tsconfig.server.json` is not referenced in root `tsconfig.json`. Running `pnpm typecheck` (`tsc -b --noEmit`) does NOT type-check `mcp/server.ts` or `mcp/main.ts`. The PR testing checklist claims "pnpm typecheck — TypeScript validation for server and client code" but server code is silently excluded. Type errors in MCP server can be introduced without failing CI or pre-commit hooks.

## Findings

**Location:** `tsconfig.json` (root)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
    // mcp/tsconfig.server.json is NOT listed here
  ]
}
```

`mcp/tsconfig.server.json` only includes `server.ts` and `main.ts` but is never invoked by the standard build. The MCP UI (`mcp-app.tsx`) is compiled by `mcp:build` via Vite, also outside `pnpm typecheck`.

## Proposed Solutions

### Solution 1: Add reference in root tsconfig (Recommended)
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./mcp/tsconfig.server.json" }
  ]
}
```
**Pros:** `pnpm typecheck` now covers server code, consistent with existing pattern. **Effort:** Trivial (1 line). **Note:** May need to fix `moduleResolution` first (see #046).

### Solution 2: Separate typecheck script
Add to `package.json`:
```json
"mcp:typecheck": "tsc --project mcp/tsconfig.server.json --noEmit"
```
And add `pnpm mcp:typecheck` to the pre-commit hook. **Pros:** No change to root tsconfig. **Cons:** Pre-commit hook change, two separate typecheck commands. **Effort:** Small.

## Recommended Action

Solution 1 — add the project reference. Requires #046 (moduleResolution fix) to be done first to avoid breaking the composite build.

## Acceptance Criteria

- [ ] `pnpm typecheck` type-checks `mcp/server.ts` and `mcp/main.ts`
- [ ] Pre-commit hook catches type errors in MCP server code
- [ ] No regression in existing typecheck

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Architecture Strategist Agent)
**Actions:** Identified typecheck gap during PR #116 architecture review.

## Technical Details

**Affected Files:**
- `tsconfig.json` (root)
- `mcp/tsconfig.server.json`
- `package.json` (if using Solution 2)

## Resources

- PR #116: Add MCP server for Claude Desktop inventory integration
- Related: #046 (moduleResolution must be fixed before adding project reference)
