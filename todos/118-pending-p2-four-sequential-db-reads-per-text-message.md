---
name: 4 sequential getPendingProductSelection DB reads per text message
description: tryTextTemplateInterception calls getPendingProductSelection up to 4 separate times via handleQtyInput, handleCartPickupTime, direct check, and resolveSelectionByIndex — same row fetched repeatedly
type: pending
priority: p2
issue_id: "118"
tags: [performance, whatsapp, supabase, webhook]
dependencies: []
---

## Problem Statement

`webhook.ts:309–400` — `tryTextTemplateInterception` triggers up to 4 independent `getPendingProductSelection` Supabase reads on the same row per inbound text message:

1. Line 320: inside `handleQtyInput` (`selection-resolver.ts:219`)
2. Line 327: inside `handleCartPickupTime` (`selection-resolver.ts:254`)
3. Line 337: direct call to check `building_order`
4. Line 367: inside `resolveSelectionByIndex` (`selection-resolver.ts:64`)

At typical Supabase latency (~30–60 ms each), the "user types something that routes to LLM" path adds 90–240 ms of redundant DB reads before the LLM call. Twilio's 15-second webhook window makes this meaningful.

## Findings

- Performance impact: +90–240 ms on every text message
- Root cause: `tryTextTemplateInterception` was grown procedurally; each branch independently fetches the same row

## Proposed Solutions

### Option A — Read once at the top, pass as parameter (Recommended)
Fetch `pending_selection` once at the start of `tryTextTemplateInterception` and pass it to each handler. Refactor handler signatures to accept an optional `selection` parameter to skip their own DB read.

**Pros:** 1 DB read instead of 4; cleaner function signatures
**Cons:** Requires signature changes on handleQtyInput, handleCartPickupTime, resolveSelectionByIndex
**Effort:** Medium
**Risk:** Low

### Option B — Add request-scoped cache
Wrap `getPendingProductSelection` in a per-request in-memory cache keyed by phone.

**Pros:** No signature changes
**Cons:** Cache invalidation complexity; stale reads if any handler writes state mid-function
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option A. The selection is read-before-write in all branches; a single upfront read is safe.

## Technical Details

- **Affected files:** `lib/whatsapp/webhook.ts:309–400`, `lib/whatsapp/selection-resolver.ts`

## Acceptance Criteria

- [ ] `getPendingProductSelection` called at most once per `tryTextTemplateInterception` invocation
- [ ] No behavioral change — same state transitions, same messages sent
- [ ] Unit test: mock verifies single DB read for text input

## Work Log

- 2026-03-17: Identified by performance-oracle and architecture-strategist review of PR #171
