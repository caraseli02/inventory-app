---
status: pending
priority: p1
issue_id: "135"
tags: [code-review, documentation, whatsapp, guardrails]
dependencies: ["134"]
---

# CLAUDE.md WhatsApp guardrails missing cart-flow and pending_selection invariants

## Problem Statement
The CLAUDE.md "WhatsApp Chat State Guardrails" section correctly documents the LLM path invariants (peek semantics, history-only prohibition) but does not mention `pending_selection` or the cart-flow code path at all. The March 17 bug (`storePendingProductSelection` swallowing errors causing cart state loss) was caused by exactly the kind of invariant this section is designed to prevent — but no guardrail exists for it.

## Findings
- CLAUDE.md lines 105-123: guardrails cover `conversation_history.messages`, `pending_order` lifecycle, history-only order prohibition
- No mention of `pending_selection` as transactional state
- No mention of invariant: "never clear `pending_selection` before `storePendingOrder` succeeds"
- No mention of cart-flow path (`handleCartPickupTime`) as a second `pending_order` creation path
- `storePendingProductSelection` still swallows errors silently (separate code fix in todo #136)
- `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md` documents the lesson but CLAUDE.md does not reflect it

## Proposed Solutions

### Option A: Extend guardrails section (Recommended)
Add to CLAUDE.md guardrails:
```
- `pending_selection` is transactional state (not just conversational): never clear cart state before `storePendingOrder` write completes without error
- Cart-flow path (`handleCartPickupTime` in selection-resolver.ts) creates `pending_order` outside LLM path — same TTL/atomicity rules apply
- `storePendingProductSelection` swallows errors by design (best-effort) — callers must not assume selection was persisted
- Reference: docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md
```
- Effort: Small

## Technical Details
- Affected file: `CLAUDE.md` lines 105-123
- Required reading section: add `docs/solutions/logic-errors/silent-store-failure-wipes-selection-state-WhatsAppAgent-20260317.md`

## Acceptance Criteria
- [ ] `pending_selection` mentioned as transactional state in guardrails
- [ ] Cart-flow path explicitly called out as second `pending_order` creation path
- [ ] "never clear cart before storePendingOrder succeeds" rule documented
- [ ] March 17 solution referenced in required reading list

## Work Log
- 2026-03-17: Identified by data-integrity-guardian agent in ce-review
