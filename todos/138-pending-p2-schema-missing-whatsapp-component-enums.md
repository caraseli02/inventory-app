---
status: done
priority: p2
issue_id: "138"
tags: [code-review, documentation, schema, whatsapp]
dependencies: []
---

# schema.yaml component enum missing WhatsApp/server-side values — api_client overloaded

## Problem Statement
All 20 WhatsApp-related solutions use `component: api_client` — a value that semantically describes Supabase/Airtable client code, not webhook handlers or server-side LLM orchestration. This makes solution search results noisy: a Supabase DB bug and a Twilio template error rank equally under any WhatsApp query. The `root_cause` enum also lacks values for LLM nondeterminism and idempotency violations.

## Findings
- `schema.yaml` component enum (lines 39-50): 11 values, all front-end / library focused
- 20 WhatsApp solutions use `api_client` for: webhook handlers (`api/whatsapp.ts`), conversation state (`lib/whatsapp/conversation-state.ts`), LLM layer (`lib/whatsapp/llm.ts`), transport (`lib/whatsapp/transport.ts`)
- `search-solutions.js` scores +5 for component match — `api_client` matches both DB and Twilio solutions equally
- Missing `root_cause` values: `llm_nondeterminism`, `idempotency_violation`, `missing_rpc`, `webhook_replay`
- Archive docs confirm similar precision problem existed before schema was introduced

## Proposed Solutions

### Option A: Add webhook_handler and server_component values (Recommended)
Add to `schema.yaml` component enum:
- `webhook_handler` — for `api/*.ts` serverless route handlers
- `server_component` — for `lib/whatsapp/`, `mcp/`, `supabase/functions/`
- `tooling` — for build/CI scripts (also fixes todo #133's committed `tooling` value)

Add to `root_cause` enum:
- `idempotency_violation` — dedup/retry bugs
- `llm_nondeterminism` — AI output inconsistency bugs
- `webhook_replay` — Twilio retry / replay issues

Then update the ~20 WhatsApp solutions to use `webhook_handler` or `server_component`.
- Effort: Medium (schema + mass update of existing solutions)

## Technical Details
- Affected file: `docs/solutions/schema.yaml`
- ~20 solution files need component value update
- `node scripts/search-solutions.js --query "whatsapp"` to identify all affected files

## Acceptance Criteria
- [x] `webhook_handler` and `server_component` added to component enum (PR #172)
- [x] `idempotency_violation` added to root_cause enum (PR #172)
- [x] All WhatsApp solutions updated to use precise component values (17 files reclassified)
- [x] `pnpm validate-docs` passes with zero errors after update (55/55)

## Work Log
- 2026-03-17: Identified by architecture-strategist and agent-native-reviewer agents in ce-review
- 2026-03-17: Fixed — 12 files set to server_component, 5 files set to webhook_handler; 55/55 validation passes
