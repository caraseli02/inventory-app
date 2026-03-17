---
name: Unvalidated pickup_time stored into pending order — no length cap or character filter
description: normalizePickupTime returns the raw trimmed user string when no pattern matches; arbitrary user text is stored in pending_order.pickup_time and sent as Twilio template variable
type: pending
priority: p2
issue_id: "119"
tags: [security, validation, whatsapp, order]
dependencies: []
---

## Problem Statement

`selection-resolver.ts:261` — `normalizePickupTime(args.text)` is called, but when the time string doesn't match any known pattern it returns the raw trimmed input. That raw string is then placed in `pending.pickup_time` and stored. It subsequently flows into:

- Twilio template variable `pickup_time` at `webhook.ts:130` — Twilio has a character limit per variable value
- Plain-text confirmation message at `selection-resolver.ts:296`

A user can send a multi-kilobyte message as "pickup time" that is stored verbatim in the DB and sent to Twilio's API.

## Findings

- `lib/whatsapp/conversation.ts:182` — `normalizePickupTime` returns `trimmed` (raw input) when no pattern matched
- `selection-resolver.ts:284` — `pickup_time: pickupTime || null` — null only when empty string

## Proposed Solutions

### Option A — Add max-length cap and character allowlist (Recommended)
After `normalizePickupTime`, enforce:
```ts
const safePickupTime = pickupTime
  ? pickupTime.slice(0, 50).replace(/[^\w\s:.,\-]/g, '')
  : null;
```

**Pros:** Simple, defensive; prevents oversized DB/template values
**Cons:** May truncate exotic but valid time strings
**Effort:** Small
**Risk:** Low

### Option B — Return null when pattern doesn't match (strict)
Treat unrecognized pickup times as "not provided" and ask again.

**Pros:** Cleaner; forces structured input
**Cons:** May frustrate users who type natural language like "mâine la ora 10"
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A for the field, paired with a max-length guard at the DB write layer.

## Technical Details

- **Affected files:** `lib/whatsapp/selection-resolver.ts:261`, `lib/whatsapp/conversation.ts`

## Acceptance Criteria

- [ ] `pickup_time` stored in DB has max 100 chars
- [ ] Template variable is always ≤ 100 chars before being sent to Twilio
- [ ] Test: very long pickup time input is truncated safely

## Work Log

- 2026-03-17: Identified by security-sentinel review of PR #171
