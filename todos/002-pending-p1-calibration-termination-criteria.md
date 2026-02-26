---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, architecture, agent-native]
dependencies: ["001"]
---

# Calibration step needs explicit termination criteria

## Problem Statement

The plan's calibration step ("run lint, observe violations, adjust thresholds") has no defined algorithm. An agent or developer executing this step has no criteria for what constitutes a valid threshold. Without explicit rules, calibration is undefined behavior: thresholds set too permissively provide zero enforcement; too strictly, they block all commits during implementation.

Combined with `--max-warnings=0` already active, any miscalibration causes an immediate hard CI failure.

## Findings

- Agent-native reviewer (P1): "Calibration step has no defined termination condition — no criteria for what threshold value is acceptable"
- Agent-native reviewer (P1): "Legacy allowlist has no discovery algorithm — no rule specifying which files to add"
- The plan's instruction: "Run pnpm lint and count violations" — leaves judgment entirely to the implementer

## Proposed Solutions

### Solution A: Define algorithm explicitly in plan (Recommended)

Replace the calibration step with this exact algorithm:

```
1. Run: pnpm lint --format json 2>/dev/null | node -e "
     const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
     const violations = {};
     d.forEach(f => f.messages.forEach(m => {
       if (!violations[m.ruleId]) violations[m.ruleId] = { count: 0, files: [] };
       violations[m.ruleId].count++;
       violations[m.ruleId].files.push(f.filePath);
     }));
     console.log(JSON.stringify(violations, null, 2));
   "
2. For each rule with violations > 0:
   - Add those files to the legacy 'off' override block
3. Verify: pnpm lint exits 0 with no output
4. Target: legacy allowlist should have <= 8 files (if more, raise max-lines threshold by 50)
```

**Pros**: Deterministic, agent-executable, produces clean baseline immediately
**Cons**: Requires running lint twice
**Effort**: Small
**Risk**: Low

### Solution B: Skip calibration, set conservative thresholds immediately

File sizes are already known. Set `max-lines: 400` (above the 3 known large files? No — they're 1433, 843, 536 lines). Add 'off' overrides for the 3 known large files. Accept that some unknown files may surface after first commit.

**Pros**: Simpler, no calibration loop
**Cons**: May miss unknown violators; developer gets surprise failures on first commit
**Effort**: Small
**Risk**: Medium

## Recommended Action

Solution A — add explicit algorithm to the plan.

## Technical Details

- **Affected files**: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md` (Step 3 update)
- **Key constraint**: `--max-warnings=0` makes any undetected violation a hard failure

## Acceptance Criteria

- [ ] Plan Step 3 (Calibration) replaced with explicit algorithm
- [ ] Algorithm specifies: how to identify violating files, rule for adding to allowlist, definition of success (lint exits 0)
- [ ] Target violation count documented (aim for <= 8 legacy overrides)

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Resources

- Plan: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
