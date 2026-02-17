---
module: CIConfig
date: 2026-02-17
problem_type: developer_experience
component: build_config
symptoms:
  - "Push events could produce empty changed-file diffs, causing unexpected low-risk classification and reduced test coverage"
  - "Risk/test detection behavior differed between pull_request and push events"
  - "RISK_POLICY_MODE was documented as overrideable but hardcoded to enforce in CI"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [ci, github-actions, risk-tiering, test-detection, devx, deployment-safety]
related_github_issue: null
commit: null
---

# Problem Description

The new risk-tiered CI checks worked for pull requests, but had two reliability gaps on push events: changed-file detection could return empty output and skip intended tests, and policy mode was hardcoded in workflow config despite documentation claiming it was configurable.

# Symptoms

- Push builds could under-classify risk and run fewer tests than expected.
- Risk/test detection was less deterministic on push compared to pull_request.
- Operators had no no-code way to switch checklist enforcement to advisory mode during incident response.
- Docs and runtime behavior were inconsistent.

# Root Cause Analysis

Two configuration-level issues caused this:

```bash
# ❌ BEFORE (risk + test scripts)
git diff --name-only "origin/$BASE_BRANCH"...HEAD
# If HEAD matches origin/main after fetch on push, diff can be empty
```

```yaml
# ❌ BEFORE (CI workflow)
env:
  RISK_POLICY_MODE: enforce
# Hardcoded, no operational override
```

# Solution

We made push detection SHA-aware and policy mode configurable with a safe default.

```bash
# ✅ AFTER (scripts)
# Prefer push SHA range when available
if [ -n "$BEFORE_SHA" ] && [ -n "$AFTER_SHA" ]; then
  git diff --name-only "$BEFORE_SHA" "$AFTER_SHA"
fi

# Fallback chain:
# 1) origin/<base>...HEAD
# 2) HEAD~1...HEAD
```

```yaml
# ✅ AFTER (CI workflow)
env:
  RISK_POLICY_MODE: ${{ vars.RISK_POLICY_MODE }}
# Script default remains enforce when unset
```

Also updated docs to match behavior and explain repository-variable override.

# Files Changed

- `scripts/detect-tests.sh`
- `scripts/detect-risk-tier.sh`
- `.github/workflows/ci.yml`
- `.github/BUILD_CHECKS.md`
- `docs/DEPLOYMENT.md`

# Verification

- Shell validation: `bash -n scripts/detect-tests.sh` and `bash -n scripts/detect-risk-tier.sh`
- Simulated push-range runs for both scripts with `BEFORE_SHA`/`AFTER_SHA`
- Project checks: `pnpm typecheck`, `pnpm lint`

# Prevention

- [x] Added push SHA range support to diff-based detection scripts.
- [x] Added empty-diff fallback in both detectors.
- [x] Aligned docs with actual configuration behavior.
- [ ] Add a CI unit test harness for detection scripts with mocked push/PR contexts.
