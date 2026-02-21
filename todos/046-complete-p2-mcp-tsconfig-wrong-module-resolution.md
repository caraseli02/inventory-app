---
status: pending
priority: p2
issue_id: "046"
tags: [typescript, mcp, code-review]
dependencies: []
---

# mcp/tsconfig.server.json uses wrong moduleResolution for ESM

## Problem Statement

`mcp/tsconfig.server.json` sets `"moduleResolution": "node"` (legacy CommonJS resolver) but the server files use ESM `.js` extension imports throughout. The legacy resolver does not understand `.js` relative imports — it expects bare `.ts` names and strips extensions itself. The TypeScript checker validates against wrong semantics, masking potential resolution mismatches.

## Findings

**Location:** `mcp/tsconfig.server.json:5` + `mcp/main.ts:6` + `mcp/server.ts:1`

```json
"moduleResolution": "node"  // legacy CommonJS
```

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; // ESM .js specifier
import { createServer } from './server.js';  // relative .js specifier
```

The `"node"` resolver treats `.js` relative imports as resolving to `.js` files literally — but `server.js` doesn't exist, only `server.ts`. This works at runtime because `tsx` bypasses TypeScript's resolver. But `tsc --noEmit` validates wrong semantics. Root configs use `"moduleResolution": "bundler"` — server config is inconsistent with both.

## Proposed Solutions

### Solution 1: Use node16/nodenext (Recommended)
```json
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    ...
  }
}
```
`node16` correctly handles `.js` specifiers for ESM Node.js code. **Effort:** Small. **Note:** Must also be fixed before adding tsconfig.server.json to root project references (#044).

### Solution 2: Use bundler resolution (matches root pattern)
```json
"module": "ESNext",
"moduleResolution": "bundler"
```
Works but semantically wrong — `tsx` is not a bundler. Acceptable pragmatic choice. **Effort:** Trivial.

## Recommended Action

Solution 1 — `node16` is semantically correct for a Node.js ESM server. Fix this before adding to root project references (#044).

## Acceptance Criteria

- [ ] `mcp/tsconfig.server.json` uses `"module": "node16"` and `"moduleResolution": "node16"`
- [ ] `pnpm typecheck` (after #044) correctly validates server imports
- [ ] `pnpm mcp:stdio` still runs correctly

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Architecture Strategist Agent)

## Technical Details

**Affected Files:**
- `mcp/tsconfig.server.json`
