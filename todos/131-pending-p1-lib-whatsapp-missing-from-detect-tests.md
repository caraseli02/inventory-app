---
status: pending
priority: p1
issue_id: "131"
tags: [code-review, ci, whatsapp, testing]
dependencies: ["130"]
---

# lib/whatsapp/ files produce test strategy "skip" — zero tests run on WhatsApp changes

## Problem Statement
`scripts/detect-tests.sh` has no case arm for any `lib/whatsapp/` file. A PR touching any file in `lib/whatsapp/` produces no `SPECIFIC_TESTS`, no `run_unit_tests=true`, and no `run_integration_tests=true`. The default fallback at line 147 checks `grep -E "src/"` — which misses `lib/whatsapp/` since it has no `src/` prefix. Result: test strategy is `skip` — zero tests run.

## Findings
- `detect-tests.sh` lines 61-132: no case entry for any `lib/whatsapp/*.ts` file
- Line 147 default: `echo "$CHANGED_FILES" | grep -qE "src/"` — misses all non-`src/` trees
- `lib/`, `api/` (except specific entries), `mcp/`, `supabase/` all have the same gap
- Line 118: `tests/unit/*.test.ts` glob misses nested subdirectories like `tests/unit/api/` and `tests/unit/lib/`
- `specific_tests` output is computed but never consumed by `ci.yml` jobs (dead output)

**Required test file mappings (missing):**
- `lib/whatsapp/conversation.ts` → `tests/unit/whatsappAgent.test.ts` + `tests/integration/whatsapp-agent.test.ts`
- `lib/whatsapp/pending-order.ts` → `tests/unit/whatsappAgent.test.ts`
- `lib/whatsapp/rate-limit.ts` → `tests/unit/whatsapp-rate-limit.test.ts`
- `lib/whatsapp/transport.ts` → `tests/unit/api/whatsapp-transport.test.ts`
- `lib/whatsapp/conversation-state.ts` → `tests/unit/api/whatsapp-conversation-state.test.ts`
- `lib/whatsapp/selection-resolver.ts` → `tests/unit/lib/whatsapp-selection-resolver.test.ts`
- `lib/whatsapp/webhook.ts` → `tests/unit/api/whatsapp-webhook.test.ts`

## Proposed Solutions

### Option A: Add lib/whatsapp/* case arms (Recommended)
Add entries to the `case` block for each `lib/whatsapp/` file, mapping to the correct test files.
```bash
lib/whatsapp/webhook.ts|lib/whatsapp/conversation.ts|...)
  add_specific_test "tests/unit/whatsappAgent.test.ts"
  add_specific_test "tests/integration/whatsapp-agent.test.ts"
  ;;
```
- Effort: Medium (10+ case entries)

### Option B: Wildcard arm for lib/whatsapp/*
Single arm: `lib/whatsapp/*)` → trigger both unit and integration WhatsApp test suites
- Effort: Small
- Less precise but better than nothing

### Option C: Fix default fallback to cover non-src/ trees
Change line 147 grep from `grep -qE "src/"` to `grep -qE "(src/|lib/|api/|mcp/)"` as a catch-all safety net
- Should be combined with A or B, not a replacement

**Recommended**: Option B (wildcard arm) + Option C (fix default grep) immediately, Option A as follow-up.

## Technical Details
- Affected files: `scripts/detect-tests.sh`
- Line 118 glob also needs fix: `tests/unit/*.test.ts` → `tests/unit/**/*.test.ts`

## Acceptance Criteria
- [ ] A PR touching `lib/whatsapp/pending-order.ts` triggers unit + integration WhatsApp tests
- [ ] `tests/unit/api/whatsapp-webhook.test.ts` is in scope (nested path matches)
- [ ] Default fallback does not silently return `skip` for `lib/` changes

## Work Log
- 2026-03-17: Identified by kieran-typescript-reviewer agent in ce-review
