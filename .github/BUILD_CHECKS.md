# Build and Quality Checks

Quality gates that run locally and in GitHub Actions.

## Local Development

Pre-commit hook runs:
- `pnpm validate-docs`
- `pnpm typecheck`
- `pnpm lint`
- `CI=true pnpm test:e2e`

This blocks commits when core checks fail.

## CI Workflows

Primary workflow: `.github/workflows/ci.yml`

CI baseline checks (all PRs/pushes):
- TypeScript project build check (`pnpm typecheck` equivalent)
- ESLint (`pnpm lint`)
- Production build (`pnpm build`)

## Risk-Tiered Policy

Risk tier is auto-detected by `scripts/detect-risk-tier.sh`:
- `low`: docs/non-critical changes
- `medium`: feature/refactor app logic changes
- `high`: deploy-critical, auth/invoice/api-core, workflow/config changes

Tier effects:
- `low`: selective tests via `scripts/detect-tests.sh`
- `medium`: broader unit + integration + e2e
- `high`: full tests + coverage + high-risk PR checklist validation

Current rollout mode defaults to `enforce` (missing items fail CI). You can temporarily relax checks by setting repository variable `RISK_POLICY_MODE=advisory`.

## High-Risk PR Requirements

For high-risk PRs, PR body should include checked items from `.github/pull_request_template.md`:
- `High-Risk Deploy Checklist Completed`
- `Rollback Plan Included`
- `Refactor Regression Proof Added`

## Troubleshooting

If CI fails:
1. Open Actions logs for `ci.yml`.
2. Fix lint/type/build/test issues locally.
3. Re-run checks by pushing updates.

If risk tier seems wrong:
1. Review changed file paths.
2. Check mapping in `scripts/detect-risk-tier.sh`.
3. Adjust path rules and commit.
