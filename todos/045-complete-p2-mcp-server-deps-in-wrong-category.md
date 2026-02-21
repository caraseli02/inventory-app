---
status: pending
priority: p2
issue_id: "045"
tags: [architecture, mcp, dependencies, code-review]
dependencies: []
---

# express, cors, MCP SDK in `dependencies` — should be devDependencies

## Problem Statement

`express`, `cors`, `@modelcontextprotocol/sdk`, and `@modelcontextprotocol/ext-apps` are placed in `dependencies` in the root `package.json`. These are server-only libraries never imported by the browser frontend (`src/`). `dependencies` communicates "required at runtime" — for production deploys/library installs, these bloat the install. One accidental import in `src/` would bundle Node.js server code into the browser.

## Findings

**Location:** `package.json:52-56`

```json
"dependencies": {
  "@modelcontextprotocol/ext-apps": "^1.0.1",
  "@modelcontextprotocol/sdk": "^1.26.0",
  ...
  "cors": "^2.8.6",
  "express": "^5.2.1",
```

Grep confirms: none of these packages are imported anywhere in `src/`. They are only used in `mcp/` scripts run via `tsx` (a devDependency). Correctly placed in devDependencies: `tsx`, `vite-plugin-singlefile`, `cross-env`, `dotenv`.

## Proposed Solutions

### Solution 1: Move to devDependencies (Recommended)
```json
"devDependencies": {
  "@modelcontextprotocol/ext-apps": "^1.0.1",
  "@modelcontextprotocol/sdk": "^1.26.0",
  "cors": "^2.8.6",
  "express": "^5.2.1",
  "@types/cors": "^2.8.19",
  "@types/express": "^5.0.6",
```
**Pros:** Correct semantic, no production install bloat. `@types/*` are already devDependencies. **Effort:** Trivial.

## Recommended Action

Move all four packages (and their @types counterparts) to `devDependencies`. Run `pnpm install` to update lockfile.

## Acceptance Criteria

- [ ] `express`, `cors`, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps` in `devDependencies`
- [ ] `pnpm mcp:serve` still works after move
- [ ] `pnpm build` (frontend) still works — no bundle regression

## Work Log

### 2026-02-20 - Code Review Discovery
**By:** Claude Code (Architecture Strategist Agent)

## Technical Details

**Affected Files:**
- `package.json`
- `pnpm-lock.yaml`
