---
status: done
priority: p2
issue_id: "143"
tags: [code-review, documentation, whatsapp]
dependencies: []
---

# WhatsApp solution docs have incomplete cross-references and open unclosed prevention checkboxes

## Problem Statement
The WhatsApp solution knowledge base has grown to 13+ files but cross-referencing has not kept up. The March 17 solution (most critical for cart integrity) is not backlinked from prior solutions. Two prevention checkboxes from the March 12 solution remain open but were addressed by later solutions without being closed. One checkbox ("audit other multi-path send functions") has no tracking issue.

## Findings

**Open checkboxes never closed in `stale-history-revives-old-order-WhatsAppAgent-20260312.md`:**
- "Implement pending_order expiry metadata" — addressed by atomic-consume solution
- "Prefer Twilio ButtonPayload over history inference" — addressed in later PRs
- Neither references the resolving solution

**March 17 solution not backlinked from prior solutions:**
- `atomic-pending-order-consume-whatsappagent-20260312.md` Related Documentation section: no reference to March 17
- `whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md` Related Documentation: pre-dates March 17

**Open checkbox with no tracking in `handle-product-selected-missing-history-append-WhatsAppAgent-20260316.md`:**
- "Audit other multi-path send functions for the same early-return pattern" — untracked, no issue, no PR

**Replay path traversal solution in wrong category:**
- `replay-mode-path-traversal-and-missing-prod-guard-WhatsAppAgent-20260316.md` is in `logic-errors/` but is a security finding
- Only one-way cross-reference to `integration-issues/` security docs

## Proposed Solutions

### Option A: Retroactive cross-reference update (Recommended)
1. Close 2 open checkboxes in `stale-history-revives-old-order` — add references to the solutions that resolved them
2. Add March 17 solution to Related Documentation in `atomic-pending-order-consume` and `whatsapp-ga-hardening`
3. Create a GitHub issue or todo for the "multi-path send audit" checkbox
4. Add cross-reference from `replay-mode-path-traversal` to `twilio-webhook-forged-requests` and vice versa
- Effort: Small

## Technical Details
- Files to update (all in `docs/solutions/logic-errors/`):
  - `stale-history-revives-old-order-WhatsAppAgent-20260312.md`
  - `atomic-pending-order-consume-whatsappagent-20260312.md`
  - `whatsapp-ga-hardening-dedup-rate-limit-atomic-order.md`
  - `handle-product-selected-missing-history-append-WhatsAppAgent-20260316.md`

## Acceptance Criteria
- [x] All open prevention checkboxes in `stale-history-revives-old-order` closed: expiry → atomic-consume doc, ButtonPayload → PRs #170-#171
- [x] March 17 solution backlinked from atomic-pending-order-consume and whatsapp-ga-hardening
- [x] todos/148-pending-p2-multi-path-send-audit.md created for multi-path send audit; checkbox linked
- [x] Path traversal solution already cross-references security solution (was already present)

## Work Log
- 2026-03-17: Identified by data-integrity-guardian agent in ce-review
