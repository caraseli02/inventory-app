---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, architecture, simplification]
dependencies: []
---

# Drop `eslint-plugin-boundaries` — use `no-restricted-imports` only

## Problem Statement

The plan installs `eslint-plugin-boundaries` to enforce module layer rules, but this plugin is over-engineered for the actual constraint being enforced. The only real architectural rule needed is: "components must not import Supabase/Airtable backends directly." `no-restricted-imports` expresses this in 4 lines with no plugin overhead.

`eslint-plugin-boundaries` requires: declaring every element type (pages, components, hooks, lib, types, assets), mapping their allowed import graph, and maintaining that map as directories change. This is significant ongoing tax for a project where the components already respect the boundary correctly (all import from `api-provider`). There is exactly one real violation — `useAgentInbox.ts` in `hooks/`, not in `components/`.

Additionally, the plugin cannot distinguish `lib/utils` from `lib/supabase-api` without further subdivision of the `lib/` element type, requiring even more config complexity.

## Findings

- Architecture reviewer (P1): "Boundary model mismatches actual codebase — components already use api-provider correctly; the plugin would require extensive element subdivision to avoid false positives"
- Simplicity reviewer (P1): "Drop eslint-plugin-boundaries entirely — one violation exists in hooks/, not components/; no-restricted-imports achieves the same goal in 4 lines"
- Current state: zero violations in `src/components/` — the rule is purely preventative
- One real violation: `src/hooks/useAgentInbox.ts` imports `lib/supabase` directly — fix this file directly rather than adding plugin infrastructure

## Proposed Solutions

### Solution A: Remove `eslint-plugin-boundaries` from plan, use `no-restricted-imports` only (Recommended)

In `eslint.config.js`, scoped to `files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}']`:

```js
'no-restricted-imports': ['error', {
  patterns: [
    {
      group: ['**/lib/supabase*', '**/lib/airtable*'],
      message: 'Use lib/api-provider instead. Components must not access backends directly.',
    },
  ],
}],
```

Fix `useAgentInbox.ts` directly (move to use api-provider or add an explicit exception comment).

**Pros**: -1 dependency, -50 config lines, zero false positives, same enforcement coverage
**Cons**: Does not enforce the broader layer model (hooks can't import components, etc.) — but that isn't a current problem
**Effort**: Small
**Risk**: Low

### Solution B: Keep `eslint-plugin-boundaries` but subdivide `lib/` elements

Define `lib/backend` (supabase.ts, supabase-api.ts, api.ts, api-provider.ts), `lib/utilities` (utils, errors, imageUpload, filters), and `lib/ai` as distinct elements. Only ban `lib/backend` from `components/`.

**Pros**: More principled architecture enforcement
**Cons**: High config complexity, ongoing maintenance, false positives if dirs change
**Effort**: Large
**Risk**: Medium (false positives block commits)

## Recommended Action

Solution A — remove the plugin, use `no-restricted-imports`, fix `useAgentInbox.ts` directly.

## Technical Details

- **Affected files**: `eslint.config.js`, `src/hooks/useAgentInbox.ts`
- **Package removed from plan**: `eslint-plugin-boundaries`
- **Plan to update**: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Acceptance Criteria

- [ ] `eslint-plugin-boundaries` removed from plan's install step
- [ ] `no-restricted-imports` config added scoped to `src/components/**` and `src/pages/**`
- [ ] `useAgentInbox.ts` direct Supabase import resolved (either fixed or explicitly excepted)
- [ ] `pnpm lint` passes after changes

## Work Log

- 2026-02-25: Created during review of `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`

## Resources

- Plan: `docs/plans/2026-02-25-feat-eslint-quality-boundaries-complexity-plan.md`
- ESLint no-restricted-imports docs: https://eslint.org/docs/latest/rules/no-restricted-imports
