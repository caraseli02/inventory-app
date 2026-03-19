---
status: complete
priority: p2
issue_id: "162"
tags: [code-review, whatsapp, testing, replay]
dependencies: []
---

# WhatsApp replay fixtures should match the real state machine (avoid false coverage)

## Problem Statement

With templates removed, the replay fixtures were updated, but at least one fixture now exercises a different code path than the description claims. This can hide regressions or create misleading “green” runs.

## Findings

- In [full-order-flow.json](/Users/vladislavcaraseli/Documents/inventory-app/fixtures/whatsapp-replay/full-order-flow.json), step 3 selects a product and transitions to `awaiting_qty`. Step 4 then sends a “direct order” freeform message containing numbers.
- In [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts), `tryTextTemplateInterception` runs `handleQtyInput` first when in `awaiting_qty`. That means step 4 will likely be interpreted as a qty reply for the selected product, not as a direct-order intent.

## Proposed Solutions

### Option 1: Split fixture into two flows (recommended)

**Approach:**
- Keep a “browse → select → qty” fixture for cart-flow interception.
- Add a separate “direct order” fixture that starts from no `pending_selection`.

**Pros:**
- Clear intent, clear coverage
- Easier debugging when replay fails

**Cons:**
- More fixtures

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Adjust step order to avoid `awaiting_qty` before direct order

**Approach:** Remove the selection steps or reset selection state before the direct-order message.

**Pros:**
- Minimal fixture changes

**Cons:**
- Still conflates two distinct behaviors

**Effort:** 30-60 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] Replay fixtures map 1:1 to state machine states they claim to test.
- [ ] At least one fixture verifies direct order creation from a clean state (no pending_selection).
- [ ] At least one fixture verifies cart-flow interception (awaiting_qty, building_order, pickup time).

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Compared fixture steps vs webhook interception ordering.
