---
title: "refactor: Fast feedback, short-lived branches, CI-as-release-truth"
type: refactor
date: 2026-02-28
origin:
  - docs/brainstorms/2026-02-17-risk-tiered-checks-brainstorm.md
  - docs/brainstorms/2026-02-25-strict-pre-commit-quality-checks-brainstorm.md
---

# refactor: Fast feedback, short-lived branches, CI-as-release-truth

## Overview

Codify a lightweight delivery policy to improve speed + quality:

1. Fast local hooks (`pre-commit`), strict remote gates (CI + optional `pre-push`)
2. Short-lived branches + small PR batches
3. "CI green = releasable" as source of truth; manual status docs are planning aids

## Problem Statement / Motivation

Current flow has strong CI but local commit feedback is heavy because `pre-commit` runs full E2E (`CI=true pnpm test:e2e`), which slows small iterations.

Also, branch/process guidance is not explicit enough to discourage long-lived branches and large PR batches. Finally, planning docs can drift from executable truth (CI status).

## Research Summary

### Internal references

- Current heavy pre-commit hook: `package.json:35`
- CI already provides strict quality gates: `.github/workflows/ci.yml:10`
- Selective/risk-based CI exists and should stay: `.github/workflows/ci.yml:68`, `.github/workflows/ci.yml:102`
- Existing high-risk checklist guard: `.github/workflows/ci.yml:254`
- Existing risk policy script + push-diff hardening: `scripts/detect-risk-tier.sh:13`, `scripts/detect-tests.sh:12`
- Existing workflow expectation text: `CLAUDE.md:819`

### Institutional learnings (docs/solutions)

- Push/PR diff detection can silently misclassify if not SHA-aware; keep current fallback chain intact:
  `docs/solutions/dx-issues/push-diff-and-risk-policy-ciconfig-20260217.md`
- Lint/quality gates already tightened under `--max-warnings=0`; avoid adding noisy/slow local checks that reduce commit cadence:
  `docs/solutions/dx-issues/no-eslint-quality-rules-eslint-config-20260225.md`

## Proposed Solution

### A. Hook split (speed-first locally, strict remotely)

- Keep `pre-commit` fast:
  - `pnpm check-root-files`
  - `pnpm validate-docs`
  - `pnpm typecheck`
  - `pnpm lint`
- Move expensive checks out of `pre-commit` and into `pre-push`:
  - `pre-push`: `pnpm test:unit && pnpm test:integration`
- Keep E2E in CI as the remote quality gate (risk-tier controlled).
- CI remains authoritative for merge/release gates.

### B. Branch + PR policy

- Branch lifetime target: under 48h (soft policy)
- PR batch size target:
  - Warn at over 300 net LOC
  - Fail at over 600 net LOC unless explicitly overridden with `size-exception` label and PR justification
- Encourage feature flags for incomplete work on trunk
- Keep risk-tier and high-risk checklist behavior unchanged

### C. Release truth policy

- Define explicitly:
  - "Releasable" means required CI checks pass on current branch/PR
  - `claude-progress.md` and `feature_list.json` are planning/tracking docs, not release authority
- Keep docs updated for communication, but do not override CI outcomes

## SpecFlow-style Gap Analysis

### User flows impacted

1. Developer commits small change
2. Developer pushes PR
3. Reviewer decides merge readiness
4. Team checks release readiness

### Edge cases to cover

- Push events with empty diff fallback (must still classify risk correctly)
- High-risk changes still require checklist lines in PR body
- Hotfix/docs-only PR should not run unnecessary full suites
- Legacy local setups without updated hooks should fail safely with setup instructions

## Implementation Plan

### Phase 1: Hook split

1. Update `package.json` simple-git-hooks config
2. Add `.git-hooks/pre-push` script for local `unit + integration` checks
3. Run local validation (`pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`) and one CI run

### Phase 2: Policy documentation

1. Add "Delivery Policy" section to `CLAUDE.md`
2. Add short note to `docs/DEPLOYMENT.md` clarifying CI-as-truth
3. Update PR template with PR-size + branch-age reminders and exception process (`size-exception`)

### Phase 3: Enforcement / observability

1. Enable/confirm branch protection requires CI jobs
2. Add CI PR-size check job (warning over 300, fail over 600 except `size-exception`)
3. Track weekly metrics for 2 weeks (GitHub source of truth):
   - median PR size
   - branch age at merge
   - CI failure before merge rate

## Acceptance Criteria

- [x] `pre-commit` no longer executes `pnpm test:e2e`
- [x] `pre-push` runs `pnpm test:unit && pnpm test:integration`
- [x] E2E remains CI-gated (not local pre-commit)
- [x] Branch/PR size policy documented in `CLAUDE.md`
- [x] PR-size CI policy enforced (warn >300, fail >600 unless `size-exception`)
- [x] "CI green = releasable" documented in `CLAUDE.md` and one deployment/process doc
- [x] High-risk checklist behavior remains intact
- [x] Team can point to one canonical release-truth statement in repo docs

## Risks & Mitigations

- Risk: More broken pushes if local checks are too light
  - Mitigation: keep typecheck + lint in pre-commit; optionally add pre-push unit/integration
- Risk: Policy ignored as "docs only"
  - Mitigation: add PR template reminders and branch protection requirements
- Risk: Confusion during transition
  - Mitigation: add short migration note and announce in team channel

## Success Metrics

- 25%+ reduction in average local commit cycle time
- PR median size below 300 net LOC within 2 weeks
- No increase in post-merge regression rate
- Fewer long-lived branches (>48h)

### Metric Source and Measurement Rules

- Source of truth: GitHub (PR metadata + Actions runs), not manual docs.
- PR size: additions + deletions per PR from GitHub diff stats.
- Branch age at merge: first commit timestamp on PR branch to merge timestamp.
- CI failure before merge: percentage of PRs with at least one failed required check before final green merge.

## Dependencies & Prerequisites

- Existing CI jobs in `.github/workflows/ci.yml`
- Maintained risk detection scripts (`scripts/detect-tests.sh`, `scripts/detect-risk-tier.sh`)
- Team agreement on branch/PR policy thresholds

## References

- `.github/workflows/ci.yml`
- `package.json`
- `CLAUDE.md`
- `docs/DEPLOYMENT.md`
- `docs/solutions/dx-issues/push-diff-and-risk-policy-ciconfig-20260217.md`
- `docs/solutions/dx-issues/no-eslint-quality-rules-eslint-config-20260225.md`
