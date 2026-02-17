---
title: Risk-tiered checks and release guardrails for new features, deploys, and refactors
type: refactor
date: 2026-02-17
---

# Refactor CI Policy: Risk-Tiered Checks + Deploy/Refactor Guardrails

## Overview

Introduce a risk-tiered quality gate model that scales verification by change risk instead of using one fixed gate for every PR. Keep current baseline checks for all changes, then add stronger checks only when changes are riskier (new feature paths, deploy-sensitive files, or refactors in core domains).

## Problem Statement / Motivation

Current CI already provides strong baseline checks (`lint`, `tsc`, `build`, selective tests). Gap: policy is not explicit about risk escalation for deploy-impacting changes and refactor regressions. That creates two failure modes:

1. Too little checking for high-risk changes (deploy/runtime regressions).
2. Too much checking for low-risk changes (slow feedback loop).

We need a predictable, auditable policy that balances safety and speed.

## Proposed Solution

Implement a 3-tier risk model in CI and PR workflow:

- `low`: docs/non-critical/UI-only small changes.
- `medium`: typical feature and refactor changes in app logic.
- `high`: deploy-critical, auth/invoice/api-core, config/workflow, or broad refactors.

Then enforce tier-specific gates:

- Baseline for all tiers: lint + typecheck + build.
- Medium: baseline + broader unit/integration + targeted e2e slice.
- High: baseline + full test matrix + deploy checklist + rollback note + stricter approval rule.

## Technical Considerations

- Reuse existing `scripts/detect-tests.sh` and `.github/workflows/ci.yml` structure; extend, do not replace.
- Add a separate risk classification script (e.g., `scripts/detect-risk-tier.sh`) with explicit path rules.
- Keep visual regression workflow (`/visual-test`) as opt-in initially; auto-require only for high-risk UI refactors in phase 2.
- Keep MVP pragmatism from operations docs: add high-risk deploy discipline without forcing full ceremony for all PRs.
- Ensure policy lives in repo docs and CI logs for transparency.

## Implementation Plan

### Phase 1: Risk Classification Foundation

1. Add `scripts/detect-risk-tier.sh`.
2. Classify using changed files + optional PR intent labels (`feature`, `refactor`, `deploy`).
3. Emit outputs: `risk_tier`, `requires_deploy_checklist`, `requires_full_tests`.
4. Document mapping table in `.github/BUILD_CHECKS.md` and `/docs/DEPLOYMENT.md`.

### Phase 2: CI Enforcement by Tier

1. Update `.github/workflows/ci.yml`:
- Add `detect-risk` job.
- Gate test breadth by tier outputs.
- Enforce full tests for `high`.
2. Add a lightweight PR checklist validation job for high-risk changes:
- Requires rollback notes.
- Requires deploy verification checklist completion.

### Phase 3: Refactor-Specific Safeguards

1. Require explicit “behavior preserved” evidence for medium/high refactors in PR template.
2. Add targeted regression test requirement for refactors touching `src/lib/**` and critical flows.
3. Add optional CODEOWNERS/approval rule escalation for `high` tier.

### Phase 4: Rollout and Calibration

1. Week 1: advisory mode (warnings only, no blocking except baseline).
2. Week 2: block on medium/high policy failures.
3. End of week 2: tune rules using CI duration and escaped defect data.

## Acceptance Criteria

- [x] Risk tier is computed automatically for each PR and visible in CI logs.
- [x] All PRs run baseline checks (lint/type/build).
- [x] Medium tier runs expanded tests beyond current selective minimum.
- [x] High tier runs full tests and enforces deploy checklist + rollback note.
- [x] Refactor PRs (medium/high) require regression-proof section in PR description.
- [ ] CI median duration increase stays within agreed threshold after calibration.
- [x] Policy documentation updated in both CI and deployment docs.

## Success Metrics

- Escaped defect rate on medium/high changes decreases vs. previous 4-week baseline.
- Failed production deployment incidents decrease.
- Median PR feedback time remains acceptable for low/medium tiers.
- Reduction in post-merge hotfixes for refactor regressions.

## Dependencies & Risks

Dependencies:
- Existing CI workflow: `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`
- Test detection script: `/Users/vladislavcaraseli/Documents/inventory-app/scripts/detect-tests.sh`
- Build/deploy docs: `/Users/vladislavcaraseli/Documents/inventory-app/.github/BUILD_CHECKS.md`, `/Users/vladislavcaraseli/Documents/inventory-app/docs/DEPLOYMENT.md`

Risks:
- Over-classification to `high` can slow delivery.
- Under-classification can miss regressions.
- PR checklist enforcement can be noisy if not staged with advisory rollout first.

Mitigations:
- Start conservative with explicit allowlist/denylist path rules.
- Run 1-2 week calibration window.
- Publish examples of tier decisions in docs.

## SpecFlow-Style Edge Cases to Cover

- Mixed PR touching docs + critical auth files should classify `high`.
- Refactor-only PR with no feature flag still needs regression evidence.
- Config-only changes (`vite.config.ts`, workflow files) should trigger high-risk policy.
- Label mismatch (e.g., marked `feature` but touches deploy files) should use file-based tier.

## References & Research

- Brainstorm source: `/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-02-17-risk-tiered-checks-brainstorm.md`
- Current CI baseline: `/Users/vladislavcaraseli/Documents/inventory-app/.github/workflows/ci.yml`
- Existing check guidance: `/Users/vladislavcaraseli/Documents/inventory-app/.github/BUILD_CHECKS.md`
- Existing deploy guidance: `/Users/vladislavcaraseli/Documents/inventory-app/docs/DEPLOYMENT.md`
- Ops safety requirements: `/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/operations_safety.md`
- Related learning (integration regression prevention): `/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/integration-issues/invoice-fastapi-auth-cors-multipart-InvoiceOCR-20260217.md`

## Out of Scope

- Replacing the full CI architecture.
- Mandatory visual regression on every PR (deferred until calibration data).
- Org-wide policy outside this repository.
