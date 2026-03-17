---
status: pending
priority: p2
issue_id: "145"
tags: [code-review, ci, mcp, testing]
dependencies: []
---

# pnpm mcp:typecheck not in CI; specific_tests output dead in CI pipeline

## Problem Statement
Two CI gaps: (1) `pnpm mcp:typecheck` runs a separate TypeScript project for the MCP server (`mcp/tsconfig.server.json`) but is absent from `ci.yml` — MCP type errors are invisible to CI. (2) `detect-tests.sh` computes `specific_tests` output and writes to `GITHUB_OUTPUT`, but `ci.yml` never declares or consumes it — the targeted test optimization is dead.

## Findings

**mcp:typecheck not in CI:**
- `package.json`: `"mcp:typecheck": "tsc --project mcp/tsconfig.server.json --noEmit"`
- `ci.yml` `validate` job: only runs `pnpm typecheck` (root project) and `pnpm lint`
- MCP server type errors only surface during Vercel deploy (too late)

**specific_tests dead in CI:**
- `detect-tests.sh` writes `specific_tests` to `GITHUB_OUTPUT`
- `ci.yml` job outputs (lines 74-78): declares `run_all_tests`, `run_unit_tests`, `run_integration_tests`, `run_e2e_tests` — NOT `specific_tests`
- `unit-tests` job always runs full `pnpm test:unit` when triggered; never a subset
- The targeted test work done in `detect-tests.sh` produces no CI benefit

## Proposed Solutions

### Option A: Add mcp:typecheck to validate job (Quick win)
```yaml
- name: Type-check MCP server
  run: pnpm mcp:typecheck
```
- Effort: Tiny
- Risk: Low

### Option B: Wire specific_tests to CI (Medium effort)
1. Add `specific_tests` to `detect-tests` job outputs in `ci.yml`
2. In `unit-tests` job, use: `run: pnpm vitest run ${{ needs.detect-tests.outputs.specific_tests }}` when `specific_tests` is non-empty, else fall back to `pnpm test:unit`
- Effort: Small-Medium
- Value: Faster PR feedback for targeted test files

**Recommended**: Both. Option A immediately (1 line). Option B in a follow-up.

## Technical Details
- Affected file: `.github/workflows/ci.yml`
- MCP tsconfig: `mcp/tsconfig.server.json`

## Acceptance Criteria
- [ ] `pnpm mcp:typecheck` runs in CI `validate` job
- [ ] A TypeScript error in `mcp/server.ts` fails CI (not just Vercel deploy)
- [ ] (Optional) `specific_tests` output is wired and reduces test runtime for targeted changes

## Work Log
- 2026-03-17: Identified by kieran-typescript-reviewer agent in ce-review
