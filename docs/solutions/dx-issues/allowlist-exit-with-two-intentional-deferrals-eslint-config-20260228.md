---
module: eslint.config.js
date: 2026-02-28
problem_type: developer_experience
component: build_config
symptoms:
  - "Allowlist cleanup looked incomplete because two files remained listed despite major refactor progress"
  - "Final PR review needed a clear merge decision on whether remaining entries were technical debt drift or approved deferrals"
  - "Without explicit re-entry triggers, deferred files could be mistaken for forgotten work"
root_cause: config_error
resolution_type: documentation_update
severity: medium
tags: [eslint, allowlist, governance, refactor, technical-debt, airtable, xlsx]
related_github_issue: null
commit: null
---

# Problem Description

After strict ESLint enforcement and large refactors, the allowlist was nearly empty. Two entries remained and were intentionally marked `NEEDS-EVALUATION`.

The merge decision required a clear record that these were approved deferrals, not unresolved actionable refactors in the same PR.

# Symptoms

- Allowlist reached near-zero, but still included:
  - `src/lib/api.ts` (legacy Airtable complexity)
  - `src/lib/xlsx/index.ts` (141L / complexity 35 mapper extraction)
- Team needed to confirm whether latest PR should merge with those two entries.
- Existing comments described defer intent, but no consolidated decision record existed.

# Root Cause Analysis

The remaining entries were structurally different from prior refactor targets:

```ts
// src/lib/api.ts
// NEEDS-EVALUATION: legacy Airtable code; defer until Airtable backend is removed/migrated.

// src/lib/xlsx/index.ts
// NEEDS-EVALUATION: column mapper extraction strategy unclear; skip until design is agreed.
```

This is a governance/sequence issue, not an implementation miss. The work depends on larger architecture decisions (Airtable sunset + xlsx mapper strategy).

# Solution

Documented and accepted merge policy for the latest PR:

1. Merge with allowlist effectively cleared except the two explicit deferrals.
2. Treat both as approved exceptions with explicit revisit triggers.
3. Prevent drift by defining hard re-entry criteria.

Re-entry triggers:

- `src/lib/api.ts`:
  - Revisit immediately after Airtable backend removal/migration is complete.
- `src/lib/xlsx/index.ts`:
  - Revisit once column-mapper extraction design and test strategy are agreed.

# Files Changed

- `eslint.config.js` (comments/allowlist state from prior refactor PR)
- `docs/solutions/dx-issues/allowlist-exit-with-two-intentional-deferrals-eslint-config-20260228.md` (this decision record)

# Verification

- Confirmed allowlist status in latest PR context:
  - Components/Hooks/Pages entries cleared.
  - Exactly two `NEEDS-EVALUATION` entries remained by design.
- Prior validation for the same PR path remained green:
  - `pnpm lint`
  - `pnpm typecheck`

# Prevention

- [x] Label deferred exceptions explicitly (`NEEDS-EVALUATION`) with rationale.
- [x] Record revisit trigger in a searchable solution doc before merge.
- [ ] Add periodic check (release checklist) to verify deferred entries still match current architecture roadmap.
- [ ] Convert each deferred entry into a dedicated todo when trigger condition becomes true.

# Related

- `docs/solutions/dx-issues/no-eslint-quality-rules-eslint-config-20260225.md`
- `docs/solutions/dx-issues/stale-checkout-reducer-actions-after-extraction-CheckoutFlow-20260228.md`
- `todos/065-complete-p3-prune-unused-checkout-reducer-actions.md`
