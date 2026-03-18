---
status: pending
priority: p2
issue_id: "153"
tags: [code-review, ci, performance]
dependencies: ["152"]
---

# `Audit dependencies` CI step is on the critical path — should be a parallel job

## Problem Statement

The `Audit dependencies` step (`node scripts/audit-check.js`) is inside the `validate` job, which all other jobs (`build`, `test:unit`, etc.) depend on. A slow npm registry response (2–8 s nominal, 20–30 s under load) delays the entire pipeline. The audit is independent of typecheck/lint and does not need to block them.

## Findings

`.github/workflows/ci.yml` `validate` job:
```yaml
- name: Run linter
  run: pnpm lint
- name: Audit dependencies   ← inserted here, blocks build/tests
  run: node scripts/audit-check.js
- name: Validate solution docs schema
  run: node scripts/validate-docs.js --all
```

All downstream jobs declare `needs: validate`. Moving audit to a parallel job would let lint, typecheck, build, and tests start immediately while the audit runs concurrently.

## Proposed Solutions

### Option A: Separate parallel `audit` job (Recommended)
```yaml
jobs:
  validate:
    # ... existing steps (no audit step)

  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: node scripts/audit-check.js
```

The `audit` job does not appear in any other job's `needs` — it runs in parallel and its result is visible in the PR checks independently.

- Effort: Small (CI YAML change)
- Risk: Low — audit failures still block PR merge via branch protection

### Option B: Keep in `validate` but add `continue-on-error: true`
Makes audit non-blocking. Reduces signal value. Not recommended.

### Option C: Keep current structure, only add the timeout fix (todo 152)
Minimal change. Audit still on critical path but with 30 s cap.

**Recommended**: Option A for correctness; Option C is acceptable interim if CI YAML refactor is undesirable now.

## Technical Details
- File: `.github/workflows/ci.yml`
- The separate job still needs `pnpm install` — use `actions/cache` for `node_modules` or rely on the `setup-node` pnpm cache integration

## Acceptance Criteria
- [ ] `Audit dependencies` runs in a separate parallel job not in `validate`
- [ ] Job has `timeout-minutes: 5`
- [ ] Audit failure still appears as a required check on PRs
- [ ] CI wall time for passing PRs does not increase

## Work Log
- 2026-03-17: Found by performance-oracle agent in ce-review of PR #173
