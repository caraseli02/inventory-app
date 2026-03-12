---
title: "refactor: Harden WhatsApp chat state and transactional order boundaries"
type: refactor
date: 2026-03-12
origin:
  - docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md
  - docs/specs/whatsapp_agent.md
  - docs/runbooks/whatsapp_agent.md
  - lib/whatsapp/conversation.ts
  - lib/whatsapp/llm.ts
  - lib/whatsapp/webhook.ts
---

# refactor: Harden WhatsApp chat state and transactional order boundaries

## Overview

Refactor the WhatsApp chat/state layer so conversational memory can improve answers without being able to silently recreate, confirm, or steer transactional order state.

The immediate trigger is the March 12, 2026 production bug where a fresh browse query revived an older milk pickup order. The broader goal is to stop future history-bleed bugs before more prompt/provider changes land.

## Problem Statement / Motivation

The current WhatsApp stack still mixes three concerns too tightly:

- conversational memory
- pending transactional state
- current-turn intent resolution

That coupling creates concrete risk:

- old assistant or user turns can bias future inventory lookup
- history-derived heuristics can synthesize `ORDER:` for the wrong turn
- pending-order lifecycle is not explicit enough for expiry, confirmation, and replay safety
- button flows and text fallback flows are logically similar but not anchored to the same state machine

Recent learnings that should guide this work:

- [`docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md)
- [`docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md)
- [`docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md)
- [`docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/solutions/logic-errors/stale-history-revives-old-order-WhatsAppAgent-20260312.md)

## Research Summary

### Internal findings

- [`lib/whatsapp/conversation.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation.ts) currently owns intent heuristics, candidate extraction, follow-up creation, and order repair.
- [`lib/whatsapp/llm.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/llm.ts) combines history loading, inventory shaping, deterministic follow-ups, provider output, and pending-order extraction.
- [`lib/whatsapp/conversation-state.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/conversation-state.ts) stores both long-lived chat memory and pending transactional state in one table surface.
- [`lib/whatsapp/webhook.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) handles text fallback and button-confirm paths, but pending-order freshness rules are still thin.

### External planning implications

- Explicit conversation state management is safer than ad hoc history stitching.
- Structured order extraction should be treated separately from general conversational memory.
- Prefer exact channel signals (`ButtonPayload`, reply context) over broad history inference for confirmation flows.

## Proposed Solution

Implement this as a boundary-hardening refactor, not a prompt-only tweak.

### Workstream 1: Define explicit state model

Introduce a documented WhatsApp state model:

- `idle`
- `browsing_inventory`
- `candidate_order`
- `awaiting_confirmation`
- `pending_order_created`
- `cancelled`
- `expired`

Deliverables:

- document state transitions in code comments or a small reference doc
- map current functions to those transitions
- identify which transitions may use history and which may not

### Workstream 2: Split conversational memory from transactional state

Keep `conversation_history.messages` useful for semantic continuity, but tighten rules:

- user turns may seed search fallback
- assistant turns may inform UI/menu selection only in explicitly bounded cases
- transactional fields (`qty`, `pickup_time`, `pending_order`) cannot be reconstructed from history alone

Implementation direction:

- rename or wrap `getPendingOrder()` with `consumePendingOrder()` semantics if clearing-on-read stays
- add `pending_order_created_at`
- add pending-order expiry checks before `DA/NU` or button-confirm handling

### Workstream 3: Replace broad order-repair heuristics with structured extraction gates

Current repair logic is too permissive. Replace it with stricter gates:

- current turn must carry enough order evidence
- product continuity may come from bounded context
- quantity and pickup time must come from the current message or an explicitly linked confirmation step
- no `ORDER:` synthesis for plain browse questions

Implementation direction:

- add a small order-evidence predicate
- separate `followup continuity` from `transaction creation`
- keep `maybeRepairOrderReply()` narrow or replace it with a structured extractor helper

### Workstream 4: Prefer channel-native confirmation signals

Make button payloads the preferred path whenever Twilio quick replies/templates are enabled.

Implementation direction:

- keep `DA/NU` as fallback only
- if reply-context metadata is available, capture and use it to anchor confirmation to the originating pending order
- require exactly one fresh pending order for text fallback confirmation

### Workstream 5: Expand regression harness

Codify production-shaped transcript tests and reuse them in future work.

Must-have regressions:

- pending order exists, then fresh browse query
- stale assistant confirmation text must not seed new order creation
- `DA` with expired pending order
- button confirm with expired pending order
- new browse query after previous exact-product order
- ambiguous browse followed by shorthand order

## Acceptance Criteria

- Fresh browse queries never recreate or confirm an older pending order.
- Pending-order creation requires current-turn order evidence or explicit confirmation signal.
- `DA/NU` fallback only works when a fresh pending order exists.
- Button confirm/cancel and text confirm/cancel obey the same pending-order lifecycle rules.
- Regression suite contains at least one production-shaped stale-history transcript.
- Repo guidance (`AGENTS.md`, `CLAUDE.md`, runbook, spec, solution docs) reflects the chat-state rules.

## Risks / Open Questions

- `conversation_history` currently stores both chat memory and pending order; the safest long-term answer may be a separate table or a more explicit schema.
- Reply-context support depends on what Twilio exposes in the current inbound payload and what fields are already available in production logs.
- Expiry windows for pending orders need product input if customer experience should remain lenient.

## Implementation Sequence

1. Add pending-order metadata + explicit consume/expiry semantics.
2. Narrow order-repair logic behind current-turn evidence checks.
3. Isolate history candidate reuse rules.
4. Add transcript regressions and button/text parity tests.
5. Revisit schema split if lifecycle logic still feels fragile.

## Validation

Minimum:

```bash
pnpm vitest run tests/unit/whatsappAgent.test.ts tests/integration/whatsapp-agent.test.ts
```

Before deploy:

- run local simulator transcript checks
- verify Orders page reflects newly created pending orders
- manually test one stale-history transcript against local webhook behavior

## Related Skills / Workflow

Use these for execution/review:

- `bug-reproduction-validator`
- `data-integrity-guardian`
- `security-sentinel`
- `deployment-verification-agent`
- `agent-browser`
- `workflows-review`
