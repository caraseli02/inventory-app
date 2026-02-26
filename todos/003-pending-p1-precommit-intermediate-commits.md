---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, developer-experience, pre-commit]
dependencies: []
---

# Pre-commit hook fails during intermediate implementation commits

## Problem Statement

The pre-commit hook runs `pnpm lint --max-warnings=0` on every commit. The implementation plan installs plugins and extends the ESLint config in separate steps. Any intermediate commit (e.g., after installing packages but before adding the legacy override block) will introduce new failing rules and immediately break the pre-commit hook.

An agent or developer following the plan step-by-step will hit this on the first `git add && git commit` after Step 2.

## Findings

- Agent-native reviewer (P1): "The plan has no instruction to either temporarily relax the hook or ensure all steps are completed before the first commit"
- Pre-commit chain in `.git-hooks/pre-commit`: `pnpm check-root-files && pnpm validate-docs && pnpm typecheck && pnpm lint && CI=true pnpm test:e2e`
- `SKIP_SIMPLE_GIT_HOOKS=1 git commit` is available as escape hatch

## Proposed Solutions

### Solution A: Complete all steps before first commit (Recommended)

Add explicit note in plan: "Complete Steps 1-4 before any `git commit`. Do not commit after installing packages alone."

Implementation order:
1. `pnpm add -D eslint-plugin-sonarjs@^1.0.4` (no commit yet)
2. Write full `eslint.config.js` changes including legacy override block (no commit yet)
3. Run calibration, add any missing legacy files to override (no commit yet)
4. Verify `pnpm lint` exits 0
5. Commit everything in one atomic commit

**Pros**: Clean, no hook bypass needed
**Cons**: Requires discipline
**Effort**: Small (documentation only)
**Risk**: Low

### Solution B: Use `SKIP_SIMPLE_GIT_HOOKS=1` for intermediate commits

Document: "During implementation, use `SKIP_SIMPLE_GIT_HOOKS=1 git commit -m 'wip: ...'` for intermediate commits. Remove WIP commits before PR."

**Pros**: More flexible for iterative development
**Cons**: Encourages hook bypass as normal workflow
**Effort**: Small
**Risk**: Low

## Recommended Action

Solution A — document atomic commit requirement in the plan.

## Technical Details

- **Pre-commit hook**: `.git-hooks/pre-commit`
- **Bypass env var**: `SKIP_SIMPLE_GIT_HOOKS=1`
- **Plan step to update**: Step 5 (Commit) — add note that Steps 1-4 must complete before any commit

## Acceptance Criteria

- [ ] Plan updated with note: "Complete Steps 1-4 before first git commit — do not commit after package install alone"
- [ ] Or: explicit `SKIP_SIMPLE_GIT_HOOKS=1` usage documented for WIP commits

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Resources

- Pre-commit hook: `.git-hooks/pre-commit`
- Plan: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
