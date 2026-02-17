---
status: complete
priority: p2
issue_id: "039"
tags: [code-review, ci, configuration, operability]
dependencies: []
---

# RISK_POLICY_MODE is hardcoded to enforce, conflicting with documented override

## Problem Statement

Documentation states policy mode can be relaxed to advisory using `RISK_POLICY_MODE=advisory`, but CI currently hardcodes `RISK_POLICY_MODE: enforce` in the detect-risk step env. This removes operational flexibility and conflicts with docs.

## Findings

- Hardcoded enforcement in workflow step env.
- Docs claim runtime override is available.

Evidence:
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml:123`
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/BUILD_CHECKS.md:33`

## Proposed Solutions

### Solution 1: Read from workflow/repo variable with fallback (Recommended)
Pros: Keeps default enforce, allows emergency advisory without code change.
Cons: Requires one variable setup.
Effort: Small
Risk: Low

### Solution 2: Keep hardcoded enforce and update docs to remove override claim
Pros: Clear behavior.
Cons: No operational escape hatch.
Effort: Small
Risk: Medium

### Solution 3: Add manual workflow_dispatch input for mode
Pros: Controlled and explicit.
Cons: More workflow complexity.
Effort: Medium
Risk: Low

## Recommended Action


## Technical Details

Affected:
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`
- `/Users/vladislavcaraseli/Documents/inventory-app/.github/BUILD_CHECKS.md`
- `/Users/vladislavcaraseli/Documents/inventory-app/docs/DEPLOYMENT.md`

## Acceptance Criteria

- [ ] CI mode defaults to enforce but is overrideable through a documented variable/input.
- [ ] Docs match actual behavior exactly.
- [ ] A quick test confirms advisory mode warnings do not fail the checklist job.

## Work Log

- 2026-02-17: Found during workflows-review of risk-tiered CI changes.
- 2026-02-17: Fixed by replacing hardcoded CI mode with repository-variable-driven mode (`vars.RISK_POLICY_MODE`) and keeping enforce as script default.

## Resources

- PR template: `/Users/vladislavcaraseli/Documents/inventory-app/.github/pull_request_template.md`
