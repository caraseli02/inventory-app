---
status: pending
priority: p2
issue_id: "141"
tags: [code-review, documentation, runbook, operations]
dependencies: []
---

# Only 1 runbook exists for 5+ operational surfaces; WhatsApp runbook missing critical scenarios

## Problem Statement
`docs/runbooks/` contains only `whatsapp_agent.md`. Four other operational surfaces (Invoice OCR, Supabase, Vercel deployment, CI risk-tier policy) have no runbook. The WhatsApp runbook itself is missing 5 operational scenarios: stuck order manual clear, rate limit reset, dedup table maintenance, RPC fallback detection, and `storePendingOrder` failure during cart flow.

## Findings
**Missing runbooks:**
| Surface | Evidence of need | Existing doc (not a runbook) |
|---|---|---|
| Invoice OCR (FastAPI) | `docs/FASTAPI_INTEGRATION.md` (693 lines) | `docs/FASTAPI_INTEGRATION.md` |
| Supabase (migrations, RLS, type regen) | 5+ migration files, ADR-0005 notes deploy friction | `docs/SUPABASE_SETUP.md` |
| Vercel deployment & rollback | `docs/DEPLOYMENT.md` exists | `docs/DEPLOYMENT.md` |
| CI risk-tier policy override | `RISK_POLICY_MODE` advisory mode | CLAUDE.md mention only |

**Missing WhatsApp runbook scenarios:**
- Stuck order: how to manually inspect/clear `pending_order` for a phone number
- Rate limit reset: `DELETE FROM whatsapp_rate_limits WHERE phone_number = '<phone>'`
- Dedup table growth: `processed_message_sids` has no TTL cleanup job (acknowledged in GA hardening solution)
- RPC fallback: what log line signals `consume_pending_order` RPC is unavailable + remediation
- `storePendingOrder` failure in cart-flow: no log event distinguishes this from other errors

## Proposed Solutions

### Option A: Extend existing WhatsApp runbook + create Supabase runbook (Recommended first step)
1. Add "Operational Scenarios" section to `docs/runbooks/whatsapp_agent.md` with 5 procedures
2. Create `docs/runbooks/supabase.md` covering: migration apply, type regeneration (`supabase gen types`), RLS verification, edge function deployment
- Effort: Medium

### Option B: Convert existing docs to runbooks
Move `docs/DEPLOYMENT.md` and `docs/FASTAPI_INTEGRATION.md` into `docs/runbooks/` with runbook format (sections: preconditions, procedure, rollback, verification).
- Effort: Small-Medium

**Recommended**: Option A first, then Option B.

## Technical Details
- Affected dir: `docs/runbooks/`
- Stuck order SQL: `SELECT pending_order FROM conversation_history WHERE phone_number = '<phone>';`
- Dedup cleanup SQL: `DELETE FROM processed_message_sids WHERE processed_at < now() - interval '7 days';`

## Acceptance Criteria
- [ ] WhatsApp runbook has 5 new operational scenarios (stuck order, rate limit, dedup, RPC fallback, storePendingOrder failure)
- [ ] Supabase runbook created covering migrations, type regen, RLS, edge functions
- [ ] At least stub runbooks for Vercel deployment and CI policy override

## Work Log
- 2026-03-17: Identified by architecture-strategist and data-integrity-guardian agents in ce-review
