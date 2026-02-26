---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, eslint, calibration]
dependencies: ["005"]
---

# Calibrate SonarJS cognitive complexity against lib/ computation files

## Problem Statement

SonarJS cognitive complexity counts optional chaining (`?.`) and nullish coalescing (`??`) as additional complexity points in some configurations. The invoice and pricing utility files (`lib/invoicePricing.ts`, `lib/invoiceImportDiffs.ts`) likely use these patterns heavily given their computational nature. Running calibration without specifically checking these files may result in miscalibrated thresholds.

## Findings

- Architecture reviewer (P3): "Run the calibration step on those files specifically before choosing the cognitive-complexity threshold"
- These files are `lib/` not `components/` — they're in the enforcement zone (lib/ is not exempted)

## Proposed Solutions

### Solution A: Explicitly include lib/ files in calibration audit

During calibration (todo #002), specifically check:
```bash
pnpm lint src/lib/invoicePricing.ts src/lib/invoiceImportDiffs.ts --format compact
```

If complexity > 30 fires on these files, either:
- Raise threshold to 20 (more permissive for lib utilities)
- Or add these files to the legacy override block

**Effort**: Trivial
**Risk**: Low

## Recommended Action

Solution A — add these files to the calibration checklist in plan Step 3.

## Acceptance Criteria

- [ ] `lib/invoicePricing.ts` and `lib/invoiceImportDiffs.ts` explicitly checked during calibration
- [ ] Threshold decision documented (either raise or add to legacy override)

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
