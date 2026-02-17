# Risk-Tiered Checks + Guardrails Execution

- [x] Add `scripts/detect-risk-tier.sh` with outputs (`risk_tier`, `requires_deploy_checklist`, `requires_full_tests`, `advisory_mode`).
- [x] Integrate risk detection into `.github/workflows/ci.yml` and gate tests/checklist jobs by tier.
- [x] Add PR checklist validation job for high-risk PRs.
- [x] Add PR template requiring deploy checklist + rollback note + refactor regression proof.
- [x] Update `.github/BUILD_CHECKS.md` and `docs/DEPLOYMENT.md` with risk-tier policy.
- [x] Update plan checkboxes in `docs/plans/2026-02-17-refactor-risk-tiered-checks-and-release-guardrails-plan.md`.
- [x] Run validation (`pnpm lint`, `pnpm typecheck`).
