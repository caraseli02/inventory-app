---
status: pending
priority: p2
issue_id: "152"
tags: [code-review, ci, performance, reliability]
dependencies: []
---

# `audit-check.js` uses `execSync` without timeout — registry hang stalls CI indefinitely

## Problem Statement

`scripts/audit-check.js` calls `execSync('pnpm audit --json --audit-level=high', ...)` with no timeout option. `pnpm audit` makes a network request to `registry.npmjs.org`. If the registry is unreachable or timing out, the Node.js process hangs indefinitely. The `Audit dependencies` CI step is in the `validate` job, which is a dependency of `build` and all test jobs — a stuck audit blocks the entire pipeline.

Additionally, if `pnpm audit` crashes with output only on stderr (not stdout), `err.stdout || ''` yields `''`, and the misleading "Failed to parse pnpm audit output" error is logged with no indication of the root cause.

## Findings

`scripts/audit-check.js` line 19:
```js
raw = execSync('pnpm audit --json --audit-level=high', { encoding: 'utf8' });
```
No `timeout` option. Default `execSync` timeout is system-level (effectively unlimited in Node.js without explicit setting).

`scripts/audit-check.js` line 22:
```js
raw = err.stdout || '';
```
`err.stderr` is silently discarded. A registry crash or pnpm internal error that only writes to stderr produces an empty `raw`, triggering a misleading parse error.

## Proposed Solutions

### Option A: Add timeout + stderr capture (Recommended)
```js
try {
  raw = execSync('pnpm audit --json --audit-level=high', { encoding: 'utf8', timeout: 30000 });
} catch (err) {
  if (err.stderr) console.error('[audit-check] pnpm audit stderr:', String(err.stderr).slice(0, 500));
  raw = err.stdout || '';
}
```
- Effort: Tiny (2 lines changed)
- Risk: None — 30 s is generous for a single npm registry call; timed-out process throws ETIMEDOUT which falls through to `raw = ''` → JSON parse fails → `process.exit(1)` (fail-closed, correct behavior)

### Option B: Move to a separate CI job with `timeout-minutes`
Isolate the audit step in a separate parallel GitHub Actions job with `timeout-minutes: 5`. Provides belt-and-suspenders protection.
- Effort: Small (CI YAML change)
- Complements Option A rather than replacing it

**Recommended**: Option A immediately; Option B as the right long-term structure (see todo 153).

## Technical Details
- File: `scripts/audit-check.js` lines 19–23
- The `execSync` timeout is in milliseconds; 30000 = 30 s

## Acceptance Criteria
- [ ] `execSync` call includes `timeout: 30000` option
- [ ] `err.stderr` is logged before discarding in the catch block
- [ ] `node scripts/audit-check.js` still exits 0 on clean repo
- [ ] Script exits 1 within 35 s when registry is unreachable (verify locally with `--network-policy=offline` or similar)

## Work Log
- 2026-03-17: Found by performance-oracle agent in ce-review of PR #173
