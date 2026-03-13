---
status: pending
priority: p2
issue_id: "097"
tags: [code-review, whatsapp, architecture, simulator, parity]
dependencies: []
---

# Simulator branch work is rebuilding the second WhatsApp system

## Problem Statement

The current branch was explicitly scoped around one architectural decision: make webhook replay the authoritative local parity path and demote the simulator to a convenience-only tool. But follow-up fixes in the branch now add pending-order storage, confirm/cancel transitions, and direct `ORDER:` handling inside the simulator path itself. That improves local convenience, but it also recreates two product surfaces:

- real webhook path through `POST /api/whatsapp`
- simulator path through `POST /api/whatsapp-simulate`

This weakens the original trust goal of the branch: one source of truth for phone-like behavior.

## Findings

- The brainstorm explicitly chose webhook replay as the authority and warned against making the simulator the truth: [`docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md#L44).
- The parity replay plan repeated that decision and said the work should avoid a big simulator rewrite: [`docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md#L67), [`docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md#L128).
- The simulator now stores pending orders directly and transforms simulator replies into confirmation-state transitions in [`lib/whatsapp/simulator.ts`](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/simulator.ts#L76).
- The simulator route now exposes transaction state directly from `/api/whatsapp-simulate` in [`api/whatsapp-simulate.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp-simulate.ts#L65).
- Docs still correctly say replay is authoritative, but the code shape now makes simulator behavior more product-complete than originally intended: [`docs/runbooks/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md#L3), [`docs/WHATSAPP_TESTING.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/WHATSAPP_TESTING.md#L48).

## Proposed Solutions

### Option 1: Collapse simulator transactional behavior onto the webhook contract (Recommended)

**Approach:** Keep the simulator UI, but make its backend call the same request/response contract as the webhook replay or a shared real-webhook orchestration seam, rather than owning a separate transaction lifecycle.

**Pros:**
- Restores one true behavioral surface
- Keeps the simulator useful without making it authoritative
- Reduces future parity drift

**Cons:**
- Requires some refactoring of the simulator route
- May make simulator UX slightly less flexible

**Effort:** Medium
**Risk:** Medium

### Option 2: Keep simulator convenience flow, but explicitly cap its scope

**Approach:** Accept that `/api/whatsapp-simulate` is a dev-only sandbox, but stop extending it further and document that its transactional results are convenience-only.

**Pros:**
- Minimal code churn
- Preserves fast local workflow

**Cons:**
- Still leaves two WhatsApp systems in code
- Drift risk remains

**Effort:** Small
**Risk:** Medium

### Option 3: Remove simulator transaction semantics entirely

**Approach:** Strip pending-order storage, confirm/cancel, and direct order creation back out of the simulator so it returns only conversational previews.

**Pros:**
- Cleanest architectural boundary
- Forces parity work onto replay

**Cons:**
- Loses useful local convenience
- Might slow some debugging loops

**Effort:** Medium
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `lib/whatsapp/simulator.ts`
- `api/whatsapp-simulate.ts`
- `lib/whatsapp/webhook.ts`
- `scripts/whatsapp-replay.ts`
- `docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`
- `docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md`

## Acceptance Criteria

- [ ] There is one clearly authoritative transactional behavior surface for local parity work
- [ ] Simulator code no longer owns unique pending-order lifecycle semantics without explicit intent
- [ ] Docs, tests, and implementation agree on the simulator’s role
- [ ] A future phone bug is debugged primarily through replay/webhook flow, not simulator-specific branches

## Work Log

### 2026-03-13 - Review finding created

**By:** Codex

**Actions:**
- Compared the current branch implementation against the original parity replay brainstorm and plan
- Identified that the simulator now owns more transactional behavior than the branch originally intended
- Recorded the architecture drift as a pending todo instead of a `docs/solutions/` entry because the issue is not solved yet

**Learnings:**
- The branch’s replay work is aligned with the intended architecture
- The simulator follow-up fixes are useful tactically, but they pull the branch back toward maintaining two WhatsApp systems

## Resources

- Brainstorm: `docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md`
- Plan: `docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md`
- Runbook: `docs/runbooks/whatsapp_agent.md`
