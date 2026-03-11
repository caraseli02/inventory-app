---
status: pending
priority: p2
issue_id: "089"
tags: [code-review, whatsapp, i18n, reliability]
dependencies: []
---

# Add Spanish order-intent handling to deterministic follow-up parsing

## Problem Statement

The new deterministic follow-up branch for multi-turn orders still only recognizes Romanian / English order verbs. Spanish follow-ups like `"1 de cada para recoger a las 19:00"` or `"quiero 1 de cada"` do not satisfy `looksLikeOrderRequest()`, so the new branch is skipped and the system falls back to the LLM path. That means the fix for the reported Spanish WhatsApp transcript is still not guaranteed by local logic.

## Findings

- `api/whatsapp.ts:1098-1100` — `looksLikeOrderRequest()` only matches Romanian / English terms such as `vreau`, `comand`, `order`, `buy`, `take`, `yes`, `da`.
- `api/whatsapp.ts:1110` — `maybeHandleOrderFollowup()` exits early when `looksLikeOrderRequest()` returns false.
- `api/whatsapp.ts:991-998` — `parseRepeatedQuantity()` already includes Spanish-style phrasing like `de cada` / `cada uno`, but the guard above prevents that path from running for common Spanish follow-ups without an English/Romanian verb.

## Proposed Solutions

### Option 1: Expand `looksLikeOrderRequest()` for Spanish and repeated-order phrasing (Recommended)

Add patterns such as `quiero`, `pedido`, `recoger`, `de cada`, `cada uno`, and possibly accept repeated-quantity phrases directly as sufficient order intent.

**Pros:** Makes the deterministic branch actually cover the reported WhatsApp scenario.
**Effort:** Small
**Risk:** Low

### Option 2: Bypass the verb gate when `parseRepeatedQuantity()` and pickup time are both present

Treat `"1 de cada a las 19:00"` as an order request even if no explicit order verb appears.

**Pros:** Minimal, language-agnostic for this specific pattern.
**Cons:** Narrower than a true locale fix.
**Effort:** Small
**Risk:** Low

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts:1098-1116`

## Acceptance Criteria

- [ ] Spanish follow-ups like `"1 de cada para recoger a las 19:00"` enter the deterministic follow-up path
- [ ] A unit or integration test proves the Spanish path without relying on LLM luck
- [ ] Existing Romanian / English follow-ups still pass

## Work Log

### 2026-03-11 — Found during workflows-review

## Resources

- **PR:** #156
