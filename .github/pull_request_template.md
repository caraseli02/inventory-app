## Summary
- What changed
- Why it changed
- If PR is large, why splitting was not feasible

## Risk Tier (auto-detected in CI)
- [ ] Low
- [ ] Medium
- [ ] High

## PR Size Policy
- Recommended: keep PR under 300 net LOC (additions + deletions)
- Hard limit: over 600 net LOC fails CI unless `size-exception` label is added
- If using `size-exception`, include explicit justification in Summary

## Testing
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] Relevant unit/integration tests
- [ ] Relevant e2e tests (if applicable)

## High-Risk Requirements
Use these checkboxes for high-risk PRs (deploy-critical, auth/invoice/api-core, config/workflow, broad refactors).

- [ ] High-Risk Deploy Checklist Completed
- [ ] Rollback Plan Included
- [ ] Refactor Regression Proof Added

## Deploy Checklist (High-Risk)
- [ ] Build and runtime env vars verified
- [ ] Migration/config compatibility verified
- [ ] Monitoring/log checks defined

## Rollback Plan
Describe how to safely roll back this change.

## Refactor Regression Proof
Describe evidence that behavior is preserved (tests, screenshots, manual validation).
