---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, eslint, simplification]
dependencies: ["002"]
---

# SonarJS: start with 1 rule, not 8

## Problem Statement

The plan adds 8 SonarJS rules simultaneously. For an initial enforcement pass on an existing codebase with known large files, this creates a wide violation surface across unrelated concerns, making it harder to triage what actually matters. Most of the 8 rules catch style issues better addressed in a dedicated refactor pass, not blocked at the lint gate.

## Findings

- Simplicity reviewer (P2): "8 SonarJS rules is too many for an initial gate — start with `sonarjs/cognitive-complexity`, add others only when there is a concrete case"
- Current 8 rules in plan: `cognitive-complexity`, `no-identical-functions`, `no-duplicate-string`, `no-all-duplicated-branches`, `prefer-immediate-return`, `no-redundant-jump`
- `cognitive-complexity` at threshold 15 does 80% of the enforcement value alone

## Proposed Solutions

### Solution A: Start with cognitive-complexity only (Recommended)

```js
rules: {
  'sonarjs/cognitive-complexity': ['error', 15],
  // Add others after Phase 2 refactor reduces noise
}
```

Add remaining rules (no-duplicate-string, no-identical-functions, etc.) as a follow-up after legacy files are refactored.

**Pros**: Clean signal, minimal noise, easier calibration
**Cons**: Misses some code smells initially
**Effort**: Small
**Risk**: Low

### Solution B: Add all 8 but start at warn, flip after calibration

Wait — can't do this because `--max-warnings=0`.

### Solution C: Keep all 8, add all legacy violating files to override

More override entries, but full enforcement from day one.

**Pros**: Complete enforcement immediately
**Cons**: Large initial override list, harder to see what's real vs legacy
**Effort**: Medium
**Risk**: Medium (false positive risk)

## Recommended Action

Solution A — just cognitive-complexity for the initial PR.

## Acceptance Criteria

- [ ] Plan reduced to `sonarjs/cognitive-complexity` only in Phase 1
- [ ] Remaining SonarJS rules documented as Phase 3 (post-refactor)
- [ ] Cognitive complexity threshold calibrated against actual codebase

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
