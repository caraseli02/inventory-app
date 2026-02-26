---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, eslint, developer-experience]
dependencies: []
---

# Resolve `.eslintignore` deprecation warning before calibration

## Problem Statement

`pnpm lint` currently emits `ESLintIgnoreWarning: The ".eslintignore" file is no longer supported`. This warning pollutes the calibration output, making it harder to count real violations. An agent running lint for calibration may miscount violations or include the warning in its analysis.

## Findings

- Agent-native reviewer (P3 elevated to P2): "The existing `.eslintignore` warning mixes with real violations during calibration output"
- ESLint 9 flat config uses `globalIgnores()` in the config file — `.eslintignore` files are not supported

## Proposed Solutions

### Solution A: Migrate ignores to eslint.config.js and delete .eslintignore (Recommended)

The current `eslint.config.js` already has `globalIgnores(['dist', '.nuxt', '.output', 'docs/**', 'coverage/**'])`. Check what `.eslintignore` contains and merge any additional paths into this call, then delete `.eslintignore`.

```bash
cat .eslintignore  # see what's there
# Add any missing entries to globalIgnores() in eslint.config.js
rm .eslintignore
```

**Pros**: Cleans warning, better calibration output, correct ESLint 9 pattern
**Effort**: Small
**Risk**: Low

## Recommended Action

Solution A — do this as Step 0 before calibration.

## Acceptance Criteria

- [ ] `.eslintignore` file deleted or does not exist
- [ ] Any ignore patterns merged into `globalIgnores()` in `eslint.config.js`
- [ ] `pnpm lint` output contains no `ESLintIgnoreWarning` before calibration begins

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
