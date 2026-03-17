---
status: pending
priority: p1
issue_id: "130"
tags: [code-review, ci, security, whatsapp, risk-tier]
dependencies: []
---

# lib/whatsapp/ classified low-risk — Twilio auth and order logic skip all tests

## Problem Statement
`scripts/detect-risk-tier.sh` has no case arm for `lib/whatsapp/`. The high-risk arm matches `api/*` and `src/lib/*`, but `lib/whatsapp/` is a top-level `lib/` directory — it falls through all case arms and stays at `low` tier. A PR modifying `lib/whatsapp/webhook.ts` (Twilio signature validation) or `lib/whatsapp/pending-order.ts` (order atomicity) skips all tests and does not trigger the High-Risk PR Checklist.

## Findings
- `detect-risk-tier.sh` line 70: high-risk arm is `src/lib/invoice*|src/lib/supabase*|...|api/*|supabase/functions/*`
- `lib/whatsapp/` does not start with `src/` — missed by `src/lib/*` medium catch-all
- No fallback medium arm covers `lib/` either — these files resolve to `low` (default no-match)
- `api/whatsapp.ts` and `api/whatsapp-simulate.ts` ARE correctly covered by `api/*` → high
- Files at risk: `lib/whatsapp/webhook.ts` (Twilio HMAC validation), `lib/whatsapp/replay-context.ts` (path traversal fix), `lib/whatsapp/rate-limit.ts`, `lib/whatsapp/dedup.ts`, `lib/whatsapp/conversation-state.ts`
- A PR removing Twilio signature validation would be classified `low` — no tests, no checklist

## Proposed Solutions

### Option A: Add lib/whatsapp/* to high-risk arm (Recommended)
In `detect-risk-tier.sh` line 70, add `lib/whatsapp/*` to the high-risk pattern:
```bash
src/lib/invoice*|src/lib/supabase*|...|api/*|supabase/functions/*|lib/whatsapp/*)
  promote_high
```
- Effort: Small (1-line change)
- Risk: Low

### Option B: Add lib/* as medium-risk catch-all
Add `lib/*` to the medium-risk arm as a safety net for any future `lib/` additions.
- Does not make WhatsApp high-risk, just prevents the silent low classification
- Should be combined with Option A

### Option C: Restructure lib/whatsapp/ under src/
Move `lib/whatsapp/` to `src/lib/whatsapp/` so it matches existing patterns.
- Effort: Large (file moves + import updates across many files)
- Not recommended without a broader restructuring plan

**Recommended**: Option A + Option B together.

## Technical Details
- Affected files: `scripts/detect-risk-tier.sh`
- Also needed: `scripts/detect-tests.sh` (separate todo #131)
- `mcp/` directory has same gap — should also be added (medium at minimum)

## Acceptance Criteria
- [ ] A PR touching only `lib/whatsapp/webhook.ts` is classified `high` risk
- [ ] The High-Risk PR Checklist CI job runs for such a PR
- [ ] `lib/whatsapp/` maps to `tests/unit/whatsappAgent.test.ts` and `tests/integration/whatsapp-agent.test.ts`

## Work Log
- 2026-03-17: Identified by kieran-typescript-reviewer and security-sentinel agents in ce-review
