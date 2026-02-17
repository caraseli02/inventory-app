---
status: complete
priority: p2
issue_id: "038"
tags: [code-review, ci, reliability, testing]
dependencies: []
---

# Push-event risk detection can skip tests due to empty diff base

## Problem Statement

Risk and test detection rely on `git diff origin/<base>...HEAD`. On push events to the default branch, `HEAD` often equals `origin/main` after fetch, producing an empty diff. This can classify a push as low risk and skip unit/integration/e2e unexpectedly.

## Findings

- `scripts/detect-risk-tier.sh` computes changed files using `git diff --name-only "origin/$BASE_BRANCH"...HEAD` without fallback when diff is empty.
- `scripts/detect-tests.sh` uses the same base diff strategy and only falls back when the command fails, not when output is empty.
- CI runs these on pushes in `.github/workflows/ci.yml`.

Evidence:
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/detect-risk-tier.sh:11`
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/detect-tests.sh:9`
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml:3`

## Proposed Solutions

### Solution 1: Use event SHA range for pushes (Recommended)
Pros: Accurate for push events. Low ambiguity.
Cons: Slightly more workflow plumbing.
Effort: Medium
Risk: Low

### Solution 2: Empty-diff fallback to `HEAD~1...HEAD`
Pros: Small script change.
Cons: Less accurate for multi-commit pushes.
Effort: Small
Risk: Medium

### Solution 3: Force medium/full tests on push-to-main
Pros: Safe and simple policy.
Cons: More CI time.
Effort: Small
Risk: Low

## Recommended Action


## Technical Details

Affected:
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/detect-risk-tier.sh`
- `/Users/vladislavcaraseli/Documents/inventory-app/scripts/detect-tests.sh`
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`

## Acceptance Criteria

- [ ] Push events use a deterministic commit range (`before..after`) or equivalent reliable diff source.
- [ ] Risk tier and test detection produce non-empty changed-file sets for normal push flows.
- [ ] CI test behavior is verified for: PR event, push event, and merge commit push.

## Work Log

- 2026-02-17: Found during workflows-review of risk-tiered CI changes.
- 2026-02-17: Fixed by adding push SHA range support (`before/after`) and empty-diff fallback in both detection scripts; CI now passes push SHAs to scripts.

## Resources

- Plan: `/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-02-17-refactor-risk-tiered-checks-and-release-guardrails-plan.md`
