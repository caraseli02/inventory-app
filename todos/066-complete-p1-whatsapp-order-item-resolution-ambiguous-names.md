---
status: complete
priority: p1
issue_id: "066"
tags: [code-review, whatsapp, reliability, ai]
dependencies: []
---

# Resolve fragile product matching in WhatsApp ORDER parsing

## Problem Statement

WhatsApp order creation can fail when the model emits item names that are partial/approximate or map to multiple products. This makes confirmed customer orders fail at runtime and degrades the main checkout path.

## Findings

- In [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L413), item resolution uses `.ilike('name', name).maybeSingle()`.
- `maybeSingle()` fails when query returns multiple rows and also misses common approximate names (no `%` wildcard pattern).
- Failure path throws and returns customer-facing failure text in [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L357), so order is not created.
- This is now high impact because prompt format intentionally allows `items` without `product_id`.

## Proposed Solutions

### Option 1: Deterministic exact+fallback resolver

**Approach:** Keep exact case-insensitive match first; on miss, run ranked fallback (prefix/contains/category hints), choose top candidate only if confidence threshold met.

**Pros:**
- Keeps behavior predictable
- Low schema impact

**Cons:**
- Still heuristic
- Needs careful tie-breaking

**Effort:** 3-5 hours

**Risk:** Medium

---

### Option 2: Require product_id in ORDER payload

**Approach:** Restore strict prompt contract to emit `product_id`; reject payloads without IDs.

**Pros:**
- Most deterministic
- Simplest server logic

**Cons:**
- Higher prompt fragility
- Requires richer inventory context with IDs again

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 3: Add search endpoint/tool call before ORDER emit

**Approach:** Resolve names via explicit lookup step, then emit canonical IDs/prices.

**Pros:**
- Most robust long term
- Better explainability/auditing

**Cons:**
- Larger change
- More latency/complexity

**Effort:** 1-2 days

**Risk:** Low

## Recommended Action


## Technical Details

**Affected files:**
- [`api/whatsapp.ts`](/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts#L398)

**Related components:**
- WhatsApp webhook order intent parser
- `orders` creation flow

**Database changes (if any):**
- No mandatory schema change

## Resources

- **Branch:** `codex/feat-close-whatsapp-agent-gaps`
- **Spec:** [`docs/specs/whatsapp_agent.md`](/Users/vladislavcaraseli/Documents/inventory-app/docs/specs/whatsapp_agent.md)

## Acceptance Criteria

- [ ] ORDER payloads with approximate product names resolve reliably or fail with explicit disambiguation prompt
- [ ] Multi-match cases no longer crash order creation path
- [ ] Unit tests cover exact match, partial match, multi-match, and no-match paths
- [ ] Existing order creation tests still pass

## Work Log

### 2026-03-04 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed WhatsApp webhook changes on branch `codex/feat-close-whatsapp-agent-gaps`
- Traced order creation failure path from `processOrderIntent` to `resolveOrderItems`
- Identified `.maybeSingle()` + non-wildcard `ilike` as brittle matcher

**Learnings:**
- Prompt contract was relaxed to allow `items` without `product_id`, raising resolver reliability requirements
- Current resolver is too strict for natural-language item extraction

## Notes

- Treat as merge-blocking for WhatsApp ordering reliability.

### 2026-03-04 - Fix Implemented

**By:** Codex

**Actions:**
- Reworked order item resolution in `api/whatsapp.ts` to use deterministic ID matching and ranked fuzzy name matching.
- Added explicit ambiguous/not-found/out-of-stock error paths with customer-safe fallback replies.
- Kept stock validation and price derivation server-side before order insert.

**Learnings:**
- Relaxing ORDER payload shape (without product IDs) requires stronger server-side disambiguation to keep checkout reliable.
