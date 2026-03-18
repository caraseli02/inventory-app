---
status: pending
priority: p2
issue_id: "151"
tags: [code-review, security, dependencies]
dependencies: []
---

# pnpm security overrides use unbounded `>=` ranges — should use `^`

## Problem Statement

All 10 pnpm overrides added in PR #173 use `>=X.Y.Z` ranges (e.g. `"tar": ">=7.5.11"`). This is too permissive: `>=` has no upper bound, meaning pnpm will accept any future major version including one that introduces a new CVE. The intent is to pin to a safe minimum, but `>=` gives false confidence — a future `tar@9.x` with a new vulnerability would be accepted without review.

## Findings

`package.json` pnpm overrides block:
```json
"tar": ">=7.5.11",          // should be "^7.5.11"
"@isaacs/brace-expansion": ">=5.0.1",  // should be "^5.0.1"
"flatted": ">=3.4.0",        // should be "^3.4.0"
"serialize-javascript": ">=7.0.3", // should be "^7.0.3"
"undici": ">=6.24.0",        // should be "^6.24.0"
"@modelcontextprotocol/sdk>hono": ">=4.12.4",  // should be "^4.12.4"
"@modelcontextprotocol/sdk>@hono/node-server": ">=1.19.10", // should be "^1.19.10"
"@modelcontextprotocol/sdk>express-rate-limit": ">=8.2.2",  // should be "^8.2.2"
```

Acceptable exceptions (intentional multi-major spans):
- `@ts-morph/common>minimatch: ">=3.1.4"` — the ReDoS fix is present across 3.x and 9.x
- `@eslint/*>minimatch: ">=3.1.4"` — same reason
- `eslint>minimatch: ">=3.1.4"` — same
- `@vercel/python-analysis>minimatch: ">=10.2.3"` — different minimum, appropriate

## Proposed Solutions

### Option A: Change 8 overrides from `>=` to `^` (Recommended)
```json
"tar": "^7.5.11",
"@isaacs/brace-expansion": "^5.0.1",
"flatted": "^3.4.0",
"serialize-javascript": "^7.0.3",
"undici": "^6.24.0",
"@modelcontextprotocol/sdk>hono": "^4.12.4",
"@modelcontextprotocol/sdk>@hono/node-server": "^1.19.10",
"@modelcontextprotocol/sdk>express-rate-limit": "^8.2.2"
```
Keep the `minimatch` entries as `>=` (multi-major intent is valid).
- Effort: Tiny (8 string changes + `pnpm install` to regenerate lockfile)
- Risk: None — `^` is semver-compatible with `>=` for all current resolved versions

### Option B: Keep `>=` but add a comment
Document the decision. Does not close the technical gap.

**Recommended**: Option A.

## Technical Details
- File: `package.json`, `pnpm.overrides` block
- Run `pnpm install` after changes to regenerate `pnpm-lock.yaml`
- Run `node scripts/audit-check.js` to verify no new advisories are introduced

## Acceptance Criteria
- [ ] 8 security overrides changed from `>=` to `^` ranges
- [ ] `minimatch` entries remain as `>=` (multi-major intent preserved)
- [ ] `pnpm install` succeeds and lockfile is updated
- [ ] `node scripts/audit-check.js` exits 0

## Work Log
- 2026-03-17: Found by security-sentinel agent in ce-review of PR #173
