---
status: done
priority: p1
issue_id: "134"
tags: [code-review, documentation, whatsapp, spec]
dependencies: []
---

# whatsapp_agent.md spec has no state machine — cart-flow path entirely undocumented

## Problem Statement
`docs/specs/whatsapp_agent.md` has no state machine diagram, no BDD scenarios for the `pending_selection` states, and no mention of the cart-flow code path (`handleCartPickupTime`). The spec is the primary regression oracle for WhatsApp changes — if it does not describe the current implementation, developers can introduce bugs in undocumented state transitions without any spec-level signal.

## Findings
- Spec lines 199-222: DB schema shown without `pending_selection` column
- No BDD scenarios for: `awaiting_qty`, `building_order`, `awaiting_pickup_time`, `category_list`, `product_list`
- `handleCartPickupTime` in `lib/whatsapp/selection-resolver.ts:246-309` creates `pending_order` outside LLM path — entirely absent from spec
- Spec changelog last entry: `0.3.0 (2026-02-23)` — all March work (cart flow, atomic consume, dedup, rate limit, templates) undocumented
- Architecture diagram (line 183) still shows Meta WhatsApp Cloud API / Edge Functions — implementation uses Twilio / Vercel

## Proposed Solutions

### Option A: Add state machine + BDD scenarios (Recommended)
Add to `whatsapp_agent.md`:
1. State machine section with all states and transitions:
   ```
   idle → category_list → product_list → awaiting_qty → building_order
     → awaiting_pickup_time → [pending_order stored] → awaiting_confirmation
     → confirmed | cancelled | expired
   ```
2. `pending_selection` column added to DB schema block
3. BDD scenarios for each state transition
4. Cart-flow path documented as a parallel path to LLM path
5. Changelog entry for all March changes
- Effort: Medium

### Option B: Create a separate `whatsapp-state-machine.md` spec
Extract state machine into its own spec file, link from `whatsapp_agent.md`.
- Effort: Medium, but splits context

**Recommended**: Option A — keep the spec as the single source.

## Technical Details
- Affected file: `docs/specs/whatsapp_agent.md`
- Related: CLAUDE.md guardrails section (separate todo #135)
- Also fix: architecture diagram still references Meta/Edge Functions

## Acceptance Criteria
- [x] State machine diagram covers all 9 states with transitions (idle → category_list → product_list → awaiting_qty → building_order → awaiting_pickup_time → confirmed|cancelled|expired)
- [x] `pending_selection` column documented in DB schema block with TTL and selection_type enum
- [x] 9 BDD scenarios cover all state transitions including error path and expiry
- [x] Cart-flow path documented: handleCartPickupTime, invariants, storePendingOrder error propagation
- [x] Architecture section updated to Twilio Content API / Vercel serverless (with ADR-0007 link)
- [x] Changelog 0.4.0 (2026-03-17) entry added

## Work Log
- 2026-03-17: Identified by architecture-strategist and data-integrity-guardian agents in ce-review
- 2026-03-17: Fixed — spec updated to v0.4.0 with state machine, BDD scenarios, pending_selection schema, cart-flow doc, Twilio/Vercel architecture
