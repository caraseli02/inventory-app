---
status: complete
priority: p2
issue_id: "163"
tags: [code-review, whatsapp, rollout, ux]
dependencies: []
---

# Legacy list-picker callbacks should degrade gracefully (or be removed explicitly)

## Problem Statement

After removing browse templates, customers may still tap old list-picker messages in their WhatsApp history. Today those callbacks are normalized into `product_N` but no longer handled, producing a generic “Nu am înțeles selecția” even though we often have enough state to recover.

## Findings

- [webhook.ts](/Users/vladislavcaraseli/Documents/inventory-app/lib/whatsapp/webhook.ts) still detects list-picker response metadata (`ListId`) and normalizes Body text `product_N` into the button flow.
- `handleButtonPayload()` now only handles `confirm` and `cancel` (by design), so `product_N` becomes a dead end.
- This makes rollout brittle for users interacting with older interactive messages.

## Proposed Solutions

### Option 1: Map `product_N` back into `resolveSelectionByIndex` (recommended for smooth rollout)

**Approach:** If incoming message is a list-picker response or has `Body=product_N`, treat it like numeric selection and call `resolveSelectionByIndex` + `handleCategorySelected` / `handleProductSelected`.

**Pros:**
- Old interactive messages still work during transition
- Uses existing selection resolver logic

**Cons:**
- Slightly increases complexity in webhook parsing

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Remove the normalization shim entirely (recommended for “hard break” simplicity)

**Approach:** If we truly want templates gone, stop special-casing list-picker responses and let them fall through to text handling.

**Pros:**
- Simpler mental model
- Avoids special-case legacy behavior

**Cons:**
- Users tapping old messages get worse UX

**Effort:** 30-60 min

**Risk:** Low

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] Decision recorded: support legacy list-picker callbacks vs hard break.
- [ ] If supported: `product_N` from old list-picker resolves correctly using stored `pending_selection`.
- [ ] If removed: list-picker responses no longer route into button flow; behavior is consistent and tested.

## Work Log

### 2026-03-19 - Identified In Review

**By:** Codex

**Actions:**
- Noted list-picker normalization still present while handlers were removed.
