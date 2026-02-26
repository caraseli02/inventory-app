---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, eslint, quality]
dependencies: ["002"]
---

# `max-lines-per-function: 80` too aggressive for `.tsx` files

## Problem Statement

The plan sets `max-lines-per-function: 80` globally. React component functions include `useCallback`, `useMemo`, and `useEffect` declarations that naturally span 80+ lines even in well-structured components. A component with 20 hook declarations is not a complexity problem — it is normal React architecture. The 80-line limit is borrowed from backend function conventions and penalizes hooks-heavy components that have low cognitive complexity.

## Findings

- Architecture reviewer (P2): "React component functions routinely hit 80 lines purely from hook declarations — max-lines-per-function should be off for .tsx files"
- Simplicity reviewer (P2): "With off overrides only on 3 named large files, threshold of 80 will fire on functions inside files not on the exception list"
- `handleConfirmImport` in `InvoiceUploadDialog.tsx` is clearly longer than 80 lines purely due to async flow, not poor design
- Alternative: rely on `sonarjs/cognitive-complexity` (threshold 15) for actual complexity enforcement

## Proposed Solutions

### Solution A: Different thresholds for .tsx vs .ts (Recommended)

Use file-specific overrides in eslint.config.js:

```js
// For .ts files (hooks, lib) — strict
{ files: ['src/**/*.ts'], rules: { 'max-lines-per-function': ['error', { max: 80 }] } },
// For .tsx files (components) — relaxed or off
{ files: ['src/**/*.tsx'], rules: { 'max-lines-per-function': 'off' } },
```

Rely on `sonarjs/cognitive-complexity` for .tsx complexity enforcement instead.

**Pros**: Right tool for each context; cognitive complexity is a better signal for React
**Cons**: Slightly more config
**Effort**: Small
**Risk**: Low

### Solution B: Raise global threshold to 120

A single threshold of 120 is less aggressive than 80 and reduces false positives while still catching truly bloated functions.

**Pros**: Simpler single rule
**Cons**: Still fires on legitimate React hooks patterns
**Effort**: Minimal
**Risk**: Low

## Recommended Action

Solution A — off for .tsx, 80 for .ts.

## Acceptance Criteria

- [ ] Plan updated: `max-lines-per-function` is either off for `.tsx` or has a higher threshold (≥120)
- [ ] `sonarjs/cognitive-complexity` is the primary complexity signal for component files
- [ ] `pnpm lint` does not flag hook declarations in well-structured components

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
