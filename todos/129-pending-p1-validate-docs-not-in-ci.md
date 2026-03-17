---
status: pending
priority: p1
issue_id: "129"
tags: [code-review, ci, documentation, enforcement]
dependencies: []
---

# validate-docs not enforced in CI — schema bypass possible

## Problem Statement
`pnpm validate-docs` runs only in the local `pre-commit` hook. It is absent from `.github/workflows/ci.yml` entirely. Any commit that bypasses hooks (`--no-verify`, GitHub web UI edits, fresh clone without `pnpm prepare`, CI-driven commits) can merge schema-invalid solution documents with zero CI gate.

## Findings
- `ci.yml` `validate` job runs only `pnpm typecheck` and `pnpm lint` — zero doc validation
- `package.json` `simple-git-hooks` runs `pnpm validate-docs` in `pre-commit` only
- Bypass vectors: `--no-verify`, web commits, CI bots, clones without `pnpm prepare`
- A PR fixing a security issue without a proper solution doc would pass CI entirely
- Invalid solution already exists in repo: `component: tooling` in `invoice-import-duplicates-and-missed-field-updates-InvoiceImport-20260212.md`

## Proposed Solutions

### Option A: Add validate-docs step to CI validate job (Recommended)
Add `pnpm validate-docs` (or `node scripts/validate-docs.js --all`) to the `validate` job in `ci.yml`.
- Requires: extend `validate-docs.js` to accept `--all` flag that runs on all files in `docs/solutions/`, not just staged ones
- Effort: Small
- Risk: Low

### Option B: Separate doc-validation CI job
Create a dedicated `doc-validation` job that runs after the `validate` job.
- Effort: Small
- Risk: Low (same as A but more visible in CI output)

### Option C: Keep pre-commit only, add CODEOWNERS for docs/solutions/
Require a docs reviewer for any `docs/solutions/` change.
- Effort: Small
- Risk: Does not catch format errors, only adds a human gate

**Recommended**: Option A — extend `validate-docs.js` to support `--all` mode and add to CI.

## Technical Details
- Affected files: `.github/workflows/ci.yml`, `scripts/validate-docs.js`
- Current pre-commit hook: `pnpm check-root-files && pnpm validate-docs && pnpm typecheck && pnpm lint`

## Acceptance Criteria
- [ ] `pnpm validate-docs` (or equivalent) runs in CI on every PR
- [ ] A PR with a schema-invalid solution doc fails CI
- [ ] The fix works for non-staged files (not just pre-commit staged files)

## Work Log
- 2026-03-17: Identified by ce-review multi-agent analysis (architecture-strategist, kieran-typescript-reviewer, security-sentinel, agent-native-reviewer)
