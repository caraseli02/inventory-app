---
status: pending
priority: p3
issue_id: "086"
tags: [code-review, quality, whatsapp, cleanup]
dependencies: []
---

# Remove dead code and merge duplicate functions in `api/whatsapp.ts`

## Problem Statement

Several functions in `api/whatsapp.ts` are either dead wrappers or identical duplicates. They add indirection, increase the file's length (already ~1,740 lines), and create latent divergence risk.

## Findings

1. **`buildReply` (lines 709–712)** — one-liner wrapper around `buildReplyWithPending` that discards `.pending`. Called from `buildSimulatorReply` line 617 only for the "hasAnthropic but not hasOpenAI" path. Can be replaced with a direct `buildReplyWithPending` call at the one call site.

2. **`parsePickupTime` (lines 945–947)** — one-line alias for `parsePickupDateTime`. Comment says "keep old name for internal callers" but no external callers exist. Three internal call sites can directly call `parsePickupDateTime`. `__private__` already exports `parsePickupDateTime`.

3. **`normalizeFreeText` (lines 853–861) and `normalizeProductText` (lines 1649–1657)** — character-for-character identical implementations. One is used in order/text matching; the other in product name resolution. Pick one name (`normalizeFreeText`) and delete the other. Future divergence would be silent.

4. **`createdOrder: boolean` in `maybeHandleOrderFollowup` return type (lines 1026, 1047, 1057)** — field is computed and returned but every caller (`runConversationTurn` line 547) only reads `.text`. Dead field.

5. **`whatsapp-notify.ts` language detection defaults to Spanish, not Romanian (line ~160)** — `return /[\u0400-\u04FF]/.test(lastUserMsg) ? 'ru' : 'es'`. The app's market is Romanian. The fallback should be `'ro'`.

## Proposed Solutions

### Option 1: Direct cleanup — remove/merge each item (Recommended)

- Delete `buildReply`; update line 617 to call `buildReplyWithPending` + return `{ provider: 'anthropic', reply: result.reply }`.
- Delete `parsePickupTime`; update 3 call sites to `parsePickupDateTime`.
- Delete `normalizeProductText`; update its 3 call sites to `normalizeFreeText`.
- Remove `createdOrder` from `maybeHandleOrderFollowup` return type and body.
- Fix `whatsapp-notify.ts` fallback language to `'ro'`.

**Effort:** Small
**Risk:** Low (all changes within single file, easily verified by typecheck)

## Recommended Action

_(blank — to be filled during triage)_

## Technical Details

**Affected files:**
- `api/whatsapp.ts` — multiple locations (see findings)
- `api/whatsapp-notify.ts:~160` — language fallback

## Acceptance Criteria

- [ ] `buildReply`, `parsePickupTime`, `normalizeProductText` removed
- [ ] All call sites updated
- [ ] `createdOrder` field removed from `maybeHandleOrderFollowup`
- [ ] `whatsapp-notify.ts` language fallback is `'ro'`
- [ ] `pnpm typecheck` passes
- [ ] No behavior change (pure refactor)

## Work Log

### 2026-03-10 — Found by code-simplicity-reviewer + agent-native-reviewer

## Resources

- **PR:** #156
