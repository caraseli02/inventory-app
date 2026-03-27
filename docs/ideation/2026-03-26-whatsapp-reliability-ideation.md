---
date: 2026-03-26
topic: whatsapp-reliability
focus: WhatsApp stability and regression resistance
---

# Ideation: WhatsApp Reliability Improvements

## Codebase Context

- The repo is a React + TypeScript + Vite inventory app with a substantial WhatsApp ordering backend layered on top of Supabase.
- The WhatsApp flow already has explicit transactional guardrails around `pending_order` and `pending_selection`, which is a strong signal that state correctness is both important and fragile.
- The project already treats replay as the authoritative local parity check in [docs/runbooks/whatsapp_agent.md](/Users/vladislavcaraseli/Documents/inventory-app/docs/runbooks/whatsapp_agent.md), but that workflow is still mostly documentation and engineering discipline rather than a productized reliability harness.
- Existing solutions in `docs/solutions/logic-errors/` show repeated failures around stale state, follow-up behavior, duplicate processing, and simulator-vs-real behavior gaps.
- Invoice/OCR and event-history areas have value, but the strongest immediate leverage is reducing WhatsApp regressions and making failures reproducible.

## Ranked Ideas

### 1. WhatsApp Reliability Harness
**Description:** Turn replay fixtures, state assertions, and transport assertions into the default workflow for stabilizing and changing the WhatsApp ordering system. Curate a small canonical replay pack for high-risk flows, add contract assertions around state transitions and outbound messages, and use bug-to-fixture capture as the primary regression mechanism.
**Rationale:** The repo already has replay tooling, state guardrails, and repeated solution docs for WhatsApp logic errors. Formalizing that into a reliability harness compounds with every bug fixed and directly targets the most unstable part of the system.
**Downsides:** Mostly internal value at first. May reveal deeper architectural issues without resolving all of them immediately.
**Confidence:** 92%
**Complexity:** Medium
**Status:** Explored

### 2. Trust / Audit Layer for Inventory Mutations
**Description:** Make stock edits, imports, and order-driven changes explainable through an audit-oriented UX that shows what changed, why it changed, and what source or workflow caused it.
**Rationale:** As the product handles more automation, operator trust becomes important. This could unify invoice import, order handling, and future event-history work.
**Downsides:** Broader and less urgent while WhatsApp behavior itself remains unstable.
**Confidence:** 88%
**Complexity:** Medium-High
**Status:** Unexplored

### 3. Operator-Grade WhatsApp Order Console
**Description:** Expand the Orders surface into a human control center for pending state, conversation context, replay/debug entry points, and failure handling.
**Rationale:** There is already meaningful operational complexity in the WhatsApp subsystem, and better operator tooling would eventually reduce support/debug effort.
**Downsides:** Premature while the underlying WhatsApp system is still unstable. Risks polishing the surface before the core is reliable.
**Confidence:** 93%
**Complexity:** Medium
**Status:** Rejected in favor of reliability-first sequencing

### 4. Invoice Import Verification Loop
**Description:** Strengthen OCR/import with better confidence handling, clearer diffs, and fixture-backed regression coverage before inventory changes land.
**Rationale:** Existing TODO-shaped test gaps suggest this remains valuable and unfinished.
**Downsides:** Strong idea, but secondary to WhatsApp stabilization for current prioritization.
**Confidence:** 87%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Offline-first field mode | High upside, but too expensive and early relative to current WhatsApp instability. |
| 2 | Event-history as a standalone direction | Better treated as an enabling part of trust/audit work than a top-level priority right now. |
| 3 | Docs/progress automation | Useful internally, but weaker immediate leverage than reliability work. |
| 4 | Generic observability improvements | Too vague compared with replay-first WhatsApp reliability work. |
| 5 | More AI/product suggestion features | Lower leverage than stabilizing transactional behavior. |
| 6 | Operator-grade WhatsApp console as next move | Valuable later, but premature before system stability improves. |

## Session Log

- 2026-03-26: Initial ideation - generated broad candidate set, narrowed to four survivors, selected WhatsApp Reliability Harness as the direction to carry into brainstorming.
- 2026-03-26: Follow-up refinement - deprioritized operator console until WhatsApp stability improves; continued with WhatsApp Reliability Harness.
