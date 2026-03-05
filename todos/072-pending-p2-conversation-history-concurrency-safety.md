---
status: pending
priority: p2
issue_id: "072"
tags: [code-review, reliability, whatsapp, supabase, concurrency]
dependencies: []
---

# Make `conversation_history` updates concurrency-safe

## Problem Statement

Conversation state is stored as an array blob (`conversation_history.messages`) and updated via read → append → upsert. Concurrent requests can lose messages by overwriting with stale history, causing wrong followups, wrong inventory context, or missed order confirmation flow.

## Findings

- `getHistory()` reads the last messages, then `saveHistory()` upserts the full array. (`/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:1032`, `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:1056`)
- Even though recent changes `await saveHistory()` in key paths, two parallel requests can still do:
  1) read same history
  2) each appends its own messages
  3) last write wins → lost turn
- This is especially likely for WhatsApp/Twilio where users can send multiple messages quickly (or Twilio retries).

## Proposed Solutions

### Option 1: Atomic append via SQL RPC (recommended)

**Approach:**
- Add a Postgres function (Supabase RPC) that appends new messages to the JSONB array in a single `update ... set messages = (messages || new_messages)` call.
- Call the RPC from `saveHistory()` instead of read→write.

**Pros:**
- Correct under concurrency
- Small changes at call sites (keep same JS API)

**Cons:**
- Requires DB change + migration management

**Effort:** 2–4 hours

**Risk:** Medium

---

### Option 2: Optimistic concurrency retry (no DB changes)

**Approach:**
- Store/compare `updated_at` from `getHistory()` read.
- On write, if `updated_at` changed, re-fetch, merge, retry (bounded attempts).

**Pros:**
- No DB migrations

**Cons:**
- More complex client logic
- Still has edge cases with bursts

**Effort:** 3–6 hours

**Risk:** Medium

---

### Option 3: Normalize schema (one row per message)

**Approach:**
- Create `conversation_messages` table: `(phone_number, role, content, timestamp)`.
- Query last N messages ordered by timestamp.

**Pros:**
- Best long-term model (searchable, no array merge)

**Cons:**
- Larger refactor + migration

**Effort:** 1–2 days

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:1008` (`getHistory`)
- `/Users/vladislavcaraseli/Documents/inventory-app/api/whatsapp.ts:1045` (`saveHistory`)

## Acceptance Criteria

- [ ] No message loss when two requests for same phone occur within 1s
- [ ] Followup flow remains correct under concurrency (menu selection / qty+time)
- [ ] Tests or a reproducible script covers concurrent writes

## Work Log

### 2026-03-05 - Review Finding

**By:** Codex

**Actions:**
- Reviewed how history is persisted and used for followups
- Identified read→append→upsert pattern can overwrite under parallel requests

**Learnings:**
- Awaiting `saveHistory()` improves ordering but doesn’t eliminate lost updates across concurrent requests

