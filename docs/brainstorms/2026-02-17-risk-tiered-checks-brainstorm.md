---
date: 2026-02-17
topic: risk-tiered-checks
---

# Risk-Tiered Checks for Features, Deploys, and Refactors

## What We're Building
A balanced quality gate model that scales checks by change risk instead of running the same intensity on every PR. The system classifies work into risk tiers (`low`, `medium`, `high`) using changed-file patterns and PR metadata, then enforces matching check bundles.

Goal: improve reliability for new features, deployments, and refactors without slowing small safe changes.

## Why This Approach
We considered strict uniform gates (highest safety, highest friction) and minimal checklist-only governance (lowest friction, weaker protection). Risk-tiered checks is the middle path: tighter controls where failure cost is high, lightweight flow for routine changes.

This aligns with current repo state: CI already has lint/type/build/selective tests, so we can extend existing patterns instead of replacing them.

## Key Decisions
- Use 3 risk tiers only (`low`, `medium`, `high`): keeps policy understandable and avoids process sprawl.
- Classify by paths + change intent tags: combine objective file signals with explicit PR intent (`feature`, `deploy`, `refactor`).
- Keep current CI as base gate for all tiers: lint/type/build remain universal.
- Add tier-specific checks incrementally:
  - `low`: current selective tests.
  - `medium`: broader unit+integration + targeted e2e slice.
  - `high`: full test suite, deploy checklist, rollback notes, and required approval policy.
- Deploy safety applies only to `high` by default: avoids forcing ops ceremony on routine UI edits.
- Refactor quality includes regression evidence: require “before/after behavior unchanged” proof for medium/high refactors.
- Track policy outcomes monthly: measure false positives, escaped defects, and CI duration; adjust thresholds.

## Open Questions
- Should `src/lib/**` changes auto-promote to `high`, or stay `medium` unless auth/payment/invoice paths are touched?
- Should visual regression checks be `medium` or `high` only?
- What is the target max CI duration for `medium` and `high` tiers?
- Do we enforce a blocking PR template checklist, or advisory initially?

## Next Steps
1. Convert this into an implementation plan with exact tier rules, workflow updates, and acceptance criteria.
2. Pilot for 1-2 weeks on current branch flow.
3. Tune thresholds based on CI time and escaped issue rate.
