---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, ci, developer-experience]
dependencies: []
---

# PR implementing this plan will be classified high-risk by CI

## Problem Statement

The CI risk detection script (`scripts/detect-risk-tier.sh`) auto-promotes PRs that touch `package.json` and `pnpm-lock.yaml` to `high` risk tier. The plan's Step 1 (install plugins) modifies both files. A `high` risk PR fails CI unless the PR body contains all three checked items. The plan makes no mention of this requirement.

## Findings

- Agent-native reviewer (P2): "Changes to package.json, pnpm-lock.yaml promote PR to high risk tier. PR body must contain all three checklist items."
- Required checklist items (from `.github/pull_request_template.md`):
  - `[x] High-Risk Deploy Checklist Completed`
  - `[x] Rollback Plan Included`
  - `[x] Refactor Regression Proof Added`
- `High-Risk PR Checklist` CI job validates these fields

## Proposed Solutions

### Solution A: Add PR body requirements to plan (Recommended)

Add to plan Step 5 (Commit):

```markdown
> **Note**: This PR touches `package.json` + `pnpm-lock.yaml` and will be classified `high` risk by CI.
> The PR body must include all three checked items from `.github/pull_request_template.md`.
> Rollback plan: remove the two devDependencies and revert `eslint.config.js` changes.
```

**Pros**: Prevents CI failure surprise
**Effort**: Small (documentation only)
**Risk**: Low

## Recommended Action

Solution A — add PR checklist note to plan.

## Acceptance Criteria

- [ ] Plan Step 5 includes note about high-risk PR classification
- [ ] Rollback plan documented: revert `pnpm remove eslint-plugin-sonarjs`, revert eslint.config.js
- [ ] PR created for this feature includes all 3 checked items

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Resources

- Risk detection: `scripts/detect-risk-tier.sh`
- PR template: `.github/pull_request_template.md`
