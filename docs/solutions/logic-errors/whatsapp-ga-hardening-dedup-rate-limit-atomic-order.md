---
title: WhatsApp GA Hardening — Dedup, Rate Limiting, Atomic Order Confirmation
module: WhatsAppAgent
date: 2026-03-14
problem_type: logic_error
component: api_client
symptoms:
  - "Twilio retries create duplicate pending orders from single customer request"
  - "Order confirmation race condition allows double-confirm from concurrent requests"
  - "Stale conversation history resurrects old product suggestions and pending orders"
  - "Greeting intent triggers expensive LLM calls instead of fast-path canned replies"
root_cause: state_race
resolution_type: code_fix
severity: critical
tags:
  - whatsapp
  - ga-blocker
  - deduplication
  - rate-limiting
  - atomic-operations
  - race-conditions
  - webhook-hardening
---

## Problem Statement

PR #169 addressed 3 critical GA blockers that prevented production readiness:

1. **Duplicate order processing**: Twilio's automatic retries (triggered by transient errors) resulted in duplicate messages being processed, creating multiple pending orders from a single customer request.
2. **Conversation quality & history abuse**: Stale product suggestions and menu selections could resurrect old pending orders; language detection was inefficient; greeting intent always triggered expensive LLM calls.
3. **Order confirmation race condition**: Simultaneous confirm/cancel requests could race, allowing double-confirmation; no atomic guarantees for pending-order consumption.

Additional improvements:
- Twilio template integration (list-picker, welcome, quantity) with plain-text fallbacks
- Product deduplication in list-picker (prevent duplicate names crowding the display)
- Webhook parity replay harness for local testing (fixture-backed scenarios)

## Root Cause Analysis

**Before PR #169**: The WhatsApp webhook processing lacked critical safeguards:

- **No dedup layer**: Twilio's HTTP retries (due to timeouts or transient 5xx errors) resulted in duplicate inbound messages. Each retry would read the same conversation state and create a new pending order. The `checkAndMarkMessageSid()` function did not exist.
- **Full-history product search**: Conversation state would use entire history to find product search candidates, allowing old product names to override fresh customer intent. Menu selections would reference menus from 10+ messages ago.
- **Non-atomic order confirmation**: The confirm path read `pending_order`, cleared it in a separate query, leaving a race window where two concurrent confirms could both read a non-null order.
- **No conversation boundaries**: Language detection ran on every message (expensive regex scans); greeting detection required LLM inference. No language preference cache.
- **Template feature gap**: List-picker template missing; all disambiguation fell back to plain text, degrading UX.
- **Variable naming bug**: `sendListPickerTemplate()` keyed variables as `"1"`, `"2"`, `"3"` instead of Twilio's expected `"product_1"`, `"product_2"`, `"product_3"` format, causing error 21656 (ContentVariables invalid).

## Working Solution

### 1. MessageSid Deduplication

**Location**: `lib/whatsapp/dedup.ts`, `supabase/migrations/20260313000001_add_processed_message_sids.sql`

**Mechanism**:
- New table `processed_message_sids` with `message_sid` (text PK) and `processed_at` (timestamptz)
- `checkAndMarkMessageSid()` function:
  - Attempts upsert: `INSERT INTO processed_message_sids (message_sid, processed_at) VALUES ($1, now()) ON CONFLICT DO NOTHING`
  - If insert succeeds (CONFLICT skipped), message is new → return `false` (proceed)
  - If insert fails (conflict), message seen before → return `true` (duplicate, skip)
  - Fails open: DB errors return `false` (allow message to prevent blocking legitimate traffic)
- Webhook checks dedup **before any processing**; bypassed for replay requests (via `x-whatsapp-replay-id` header)

**Effectiveness**: Prevents processing the same Twilio message twice, even if webhook is called multiple times by retries.

### 2. Per-Phone Rate Limiting

**Location**: `lib/whatsapp/rate-limit.ts`, `supabase/migrations/20260313000002_conversation_history_columns.sql`

**Mechanism**:
- New table `whatsapp_rate_limits` with sliding 60-second window per phone
- Schema: `{ phone_number (text PK), message_count (int), window_start (timestamptz) }`
- `checkRateLimit()` function:
  - If current time > `window_start + 60s`, reset counter to 1 and return `{ allowed: true }`
  - Else increment counter; return `{ allowed: message_count <= 10 }`
  - **10 messages per 60 seconds per phone** (prevents LLM cost spikes from abuse)
- Fails open: DB errors allow message through
- Bypassed for replay requests

**Webhook behavior when rate limit exceeded**:
```typescript
if (!allowed) {
  await replyViaAvailableChannel({
    res, from,
    message: buildRateLimitReply(),  // Bilingual throttle message
    canUseRest,
  });
  return;
}
```

### 3. Conversation Quality Improvements

**Menu Scan Window** (`lib/whatsapp/conversation.ts:233–244`):
- `findLastMenuOptions()` only examines the **last 2 assistant messages**
- Prevents old numbered menus (1) 2) 3)) from being used for new product queries
- If no menu found in last 2, falls back to current inventory text

**Greeting Fast-Path** (`lib/whatsapp/llm.ts:48–69`):
- `classifyIncomingText()` detects pure greetings: bună, hello, hi, salut (exact match, no extra words)
- Returns canned bilingual reply without LLM inference
- Sets `welcomeTemplate: true` flag; webhook sends Twilio welcome template with intent buttons
- Avoids expensive API call for simple hellos

**Current-Turn-First Product Search** (`lib/whatsapp/llm.ts:107–113`):
```typescript
const searchCandidatesCurrent =
  intent === 'product_query' ? extractSearchCandidates(userText) : [];
const searchCandidatesFromHistory =
  intent === 'product_query' ? extractSearchCandidatesFromHistory(history) : [];

// Guard: only fall back to history if current turn yields nothing
const searchCandidatesUsed = searchCandidatesCurrent.length > 0
  ? searchCandidatesCurrent
  : searchCandidatesFromHistory;
```
- Extracts product names from current message first
- Only uses history (last 4 user messages) if current turn has no candidates
- Prevents stale product names from overriding fresh intent

**Language Preference Caching** (`lib/whatsapp/conversation-state.ts:186–209`):
- Stores user language in `conversation_history.language` column ('en' or 'ro')
- Detected via English loanword regex; cached per phone
- Avoids per-turn false-positives on bilingual messages
- Greeting fast-path reads stored language, falls back to current-message detection

### 4. Atomic Order Confirmation

**RPC with FOR UPDATE Lock** (`supabase/migrations/20260313000003_consume_pending_order_rpc.sql`):

```sql
CREATE OR REPLACE FUNCTION consume_pending_order(p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_order JSONB;
BEGIN
  -- Acquire row-level lock before reading
  SELECT pending_order INTO v_order
  FROM conversation_history
  WHERE phone_number = p_phone
  FOR UPDATE;

  IF v_order IS NULL THEN RETURN NULL; END IF;

  -- Atomically clear within same transaction
  UPDATE conversation_history
  SET pending_order = NULL, updated_at = now()
  WHERE phone_number = p_phone;

  RETURN v_order;
END;
$$;
```

- Single atomic transaction: acquire lock → read → clear → return
- `FOR UPDATE` prevents concurrent reads/writes on the same conversation row
- Non-atomic fallback in `consumePendingOrder()` (`lib/whatsapp/conversation-state.ts:121–164`):
  - If RPC unavailable (local dev without RPC), reads then separately clears (two round-trips, not atomic but functional)
  - Returns `PendingOrderState` enum: `{ status: 'missing'|'expired'|'fresh'; order?: ... }`

### 5. Twilio Template Integration

**Feature Gate** (`lib/whatsapp/llm.ts:120–133`):
- Checks `process.env.TWILIO_PRODUCT_LIST_SID`, `TWILIO_WELCOME_SID`, `TWILIO_QTY_SID`
- All optional; plain-text fallbacks used if not set

**List-Picker Template** (product disambiguation):
- When product query yields 2–10 distinct product names, returns `{ listPicker: [...] }`
- Webhook calls `sendListPickerTemplate()` with product list
- Twilio sends customer selection as Body text (e.g., `product_3`), not ButtonPayload
- Webhook detects `ListId` field + `product_N` pattern, treats as button selection

**Template Variables** (`lib/whatsapp/transport.ts:62–71`):
```typescript
const variables: Record<string, string> = {};
items.forEach((item, index) => {
  variables[`product_${index + 1}`] = item;  // ← product_1, product_2, ...
});

const contentVariables = JSON.stringify(variables);
// Send as form param: ContentVariables={"product_1":"...","product_2":"..."}
```

**Product Deduplication** (`lib/whatsapp/inventory.ts:271–294`):
- Fetches products by category, deduplicates by name
- Keeps **cheapest variant** per product name
- Truncates to 60 chars (Twilio template variable length limit)
- Returns top 6 distinct names

**Template Fallback Chain** (`lib/whatsapp/webhook.ts:508–525`):
1. Try sending template (list-picker, welcome, quantity)
2. If send fails or SID not set, send plain text equivalent
3. LLM reply sent **before** confirmation template (decouples conversation from transactional state)

## Code Examples

### Dedup Check (webhook.ts:498–506)
```typescript
if (!replayId && messageSid) {
  const dedupClient = createSupabaseClient();
  const isDuplicate = await checkAndMarkMessageSid(dedupClient, messageSid);
  if (isDuplicate) {
    console.log(`[whatsapp] duplicate MessageSid ${messageSid} — skipping`);
    return res.status(200).send(twiml(''));
  }
}
```

### Rate Limit Check (webhook.ts:532–546)
```typescript
if (!replayId) {
  const rateLimitClient = createSupabaseClient();
  const { allowed } = await checkRateLimit(rateLimitClient, phone);
  if (!allowed) {
    console.warn(`[whatsapp] rate limit exceeded for ${phone}`);
    await replyViaAvailableChannel({
      res, from,
      message: buildRateLimitReply(),  // "Prea multe mesaje..."
      canUseRest,
    });
    return;
  }
}
```

### Atomic Consume (conversation-state.ts:121–143)
```typescript
export async function consumePendingOrder(
  sb: ServerSupabaseClient,
  phone: string,
): Promise<PendingOrderState> {
  try {
    // Try atomic RPC path first
    const rpcResult = await (sb as any).rpc('consume_pending_order', { p_phone: phone });
    if (!rpcResult?.error && rpcResult?.data !== undefined) {
      const order = rpcResult.data as PendingOrder;
      return toPendingOrderState(order);
    }
    console.warn('[whatsapp] consume_pending_order RPC unavailable:', rpcResult?.error);
  } catch (err) {
    // fall through to non-atomic fallback
  }

  // Non-atomic fallback
  const { data: history } = await sb
    .from('conversation_history')
    .select('pending_order, updated_at')
    .eq('phone_number', phone)
    .single();

  if (!history?.pending_order) return { status: 'missing', order: null };

  // Check expiry
  const age = Date.now() - new Date(history.updated_at).getTime();
  if (age > 3600000) return { status: 'expired', order: null };  // 1 hour

  // Clear (non-atomic)
  await sb
    .from('conversation_history')
    .update({ pending_order: null, updated_at: new Date().toISOString() })
    .eq('phone_number', phone);

  return { status: 'fresh', order: history.pending_order };
}
```

### Current-Turn Product Search (llm.ts:107–113)
```typescript
const searchCandidatesCurrent = intent === 'product_query'
  ? extractSearchCandidates(args.text)
  : [];
const searchCandidatesFromHistory = intent === 'product_query'
  ? extractSearchCandidatesFromHistory(history)
  : [];

const searchCandidatesUsed = searchCandidatesCurrent.length > 0
  ? searchCandidatesCurrent
  : searchCandidatesFromHistory;
```

### List-Picker Response Detection (webhook.ts:469–483)
```typescript
const isListPickerResponse = !!(body.ListId && text.match(/^product_\d+$/));
if (isListPickerResponse) {
  buttonPayload = text;  // product_1, product_2, etc.
  text = '';             // Don't process as regular message
  console.log('[whatsapp] detected list-picker response:', buttonPayload);
}
```

## Testing

**Unit Tests**:
- `tests/unit/whatsappAgent.test.ts` — Intent classification (greeting, reset), menu selection window, current-turn product search
- `tests/unit/whatsapp-rate-limit.test.ts` — Rate limit window reset, per-phone isolation, fail-open behavior
- `tests/unit/api/whatsapp-webhook.test.ts` — Dedup detection, list-picker response parsing, template fallbacks
- `tests/unit/api/whatsapp-conversation-state.test.ts` — Atomic consume vs fallback, pending order expiry, language caching

**Integration Tests**:
- `tests/integration/whatsapp-agent.test.ts` — Full order flow with dedup, rate limit, menu selection, RPC confirmation

**Minimum Regression Set** (before merging WhatsApp changes):
```bash
pnpm vitest run \
  tests/unit/whatsappAgent.test.ts \
  tests/integration/whatsapp-agent.test.ts
```

Must cover:
- Fresh product browse after prior pending order
- Exact-product order creation with rate limit / dedup
- Button confirm/cancel with atomic RPC
- DA/NU text fallback
- Expired pending-order cleanup

**Fixture-Backed Replay Tests** (local parity validation):
```bash
pnpm whatsapp:replay --list
pnpm whatsapp:replay --fixture inventory-qa
pnpm whatsapp:replay --fixture order-creation
pnpm whatsapp:replay --fixture confirm-cancel
```

These send Twilio-shaped requests through the real webhook, capturing dedup, rate limit, and async template transport behavior.

## Prevention Strategies

### Deduplication & Idempotency
- Always check `MessageSid` against `processed_message_sids` **before** state mutations
- Dedup must fail-open (allow on DB error) to avoid breaking legitimate traffic
- Document why dedup is necessary: Twilio retries, network timeouts, flaky webhooks

### Rate Limiting & Abuse Prevention
- Per-phone sliding window (60s) with 10-message threshold prevents LLM cost spikes
- Alert on sustained rate limit hits (may indicate spam or legitimate high-volume use)
- Bilingual rate limit reply helps customer understand the boundary
- Non-override path: no way for simulator or local dev to bypass (preserves invariant)

### Conversation History Boundaries
- Limit menu extraction to **last 2 assistant messages only**
- Limit product search history to **last 4 user messages only**
- Always prefer **current-turn evidence** over history
- Document: conversational memory ≠ transactional order state (separate concerns)

### Atomic Order Confirmation
- Use RPC with `FOR UPDATE` lock when possible (Supabase serverless)
- Non-atomic fallback must still check expiry before clearing
- Test concurrent confirm/cancel via fixtures (pnpm whatsapp:replay)
- Monitor for "double-confirm" patterns in production logs

### Template Fallbacks
- Always have plain-text fallback for template sends
- Send LLM reply **before** confirmation template (decouples text from state)
- Log template send errors separately (alert on repeated failures)
- Test template send failures in integration tests (mock Twilio timeout)

### Webhook Parity & Local Testing
- Replay harness is source of truth for phone behavior (not simulator)
- Fixtures must include realistic Twilio metadata (MessageSid, Body, ButtonPayload, ListId)
- Capture async transport events (REST/template sends) in replay output
- CI must run `pnpm whatsapp:replay --fixture *` before merge

## Specialized Agent Reviews

### Data Integrity Review ✅
- **RPC Atomicity**: FOR UPDATE lock correctly implemented; single-transaction semantics prevent double-confirm
- **Fallback Safety**: Non-atomic read-then-clear safely handles expiry before clearing
- **Race Conditions**: Concurrent confirm/cancel tested; second request sees null, blocked correctly
- **Migrations**: All idempotent and backward-compatible
- **Recommendations**:
  - Add MessageSid TTL cleanup (processed_message_sids table can grow indefinitely)
  - Add concurrent confirm/cancel fixture tests
  - Monitor for double-confirm patterns in production logs

### Security Review ✅
- **Rate Limit Bypass (Replay)**: Intentionally bypassed for test vectors; SAFE but document as internal-only
- **Dedup Fail-Open**: DB errors return false (allow message); acceptable for MVP, add idempotency keys post-GA
- **Template Injection**: Twilio validates ContentVariables server-side; low risk
- **Language Detection**: Static keyword matching; no injection vectors
- **Pending Order Validation**: Acceptable (RLS enforced by schema), recommend zod validation post-GA
- **Status**: PRODUCTION-READY

## Known Gaps & TODOs

- **TODO 096** (`todos/096-complete-p2-webhook-replay-misses-async-replies.md`): Replay harness now captures async transport (RESOLVED in PR #169), but docs may need update to reflect.
- **TODO 097** (`todos/097-pending-p2-simulator-rebuilds-second-whatsapp-system.md`): Simulator owns some transactional behavior (pending orders, confirm/cancel); consider collapsing onto real webhook contract in future refactor.
- **Post-GA**: Add MessageSid TTL cleanup job; add pending-order zod schema validation; add concurrent test fixtures

## Related Issues & Documentation

### Prior WhatsApp Solutions
- [atomic-pending-order-consume-whatsappagent-20260312.md](atomic-pending-order-consume-whatsappagent-20260312.md) — Atomic pending-order consumption via RPC with FOR UPDATE lock
- [stale-history-revives-old-order-WhatsAppAgent-20260312.md](stale-history-revives-old-order-WhatsAppAgent-20260312.md) — History handling guardrails; restrict to last 4 user messages
- [button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md](button-confirm-skipped-pending-status-WhatsAppAgent-20260310.md) — Order status lifecycle (pending vs confirmed)
- [quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md](quick-reply-followup-and-simulator-auth-WhatsAppAgent-20260311.md) — Multi-turn conversation drift prevention
- [followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md](followup-shows-unrelated-inventory-WhatsAppAgent-20260305.md) — Restrict history search to user messages only
- [twilio-webhook-forged-requests-whatsapp-webhook-20260304.md](../integration-issues/twilio-webhook-forged-requests-whatsapp-webhook-20260304.md) — Twilio signature validation (HMAC-SHA1)

### Architecture & Planning
- [docs/specs/whatsapp_agent.md](../../specs/whatsapp_agent.md) — WhatsApp AI agent feature spec
- [docs/plans/2026-03-12-refactor-whatsapp-chat-state-plan.md](../../plans/2026-03-12-refactor-whatsapp-chat-state-plan.md) — Chat-state hardening refactor
- [docs/plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md](../../plans/2026-03-13-feat-whatsapp-webhook-parity-replay-plan.md) — Webhook parity replay harness
- [docs/brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md](../../brainstorms/2026-03-13-whatsapp-parity-replay-brainstorm.md) — Parity-first testing strategy
- [docs/runbooks/whatsapp_agent.md](../../runbooks/whatsapp_agent.md) — Operational guide for local testing

### Related Tests
- [tests/unit/whatsappAgent.test.ts](../../../tests/unit/whatsappAgent.test.ts) — Core agent logic tests
- [tests/integration/whatsapp-agent.test.ts](../../../tests/integration/whatsapp-agent.test.ts) — Multi-turn flow tests
- [tests/unit/api/whatsapp-webhook.test.ts](../../../tests/unit/api/whatsapp-webhook.test.ts) — Webhook validation tests
- [tests/unit/api/whatsapp-conversation-state.test.ts](../../../tests/unit/api/whatsapp-conversation-state.test.ts) — Conversation state tests
- [tests/unit/whatsapp-rate-limit.test.ts](../../../tests/unit/whatsapp-rate-limit.test.ts) — Rate limiting tests

### GitHub Issues
- [#125](https://github.com/caraseli02/inventory-app/issues/125) — Twilio signature validation requirement

## Acceptance Criteria ✅

- [x] MessageSid dedup prevents duplicate order processing
- [x] Rate limiting caps 10 msg/60s per phone
- [x] Menu scan limited to last 2 assistant messages
- [x] Greeting intent fast-path skips LLM
- [x] Current-turn product search prefers fresh evidence over history
- [x] Atomic `consume_pending_order` RPC with FOR UPDATE lock
- [x] Non-atomic fallback for local dev (read-then-clear)
- [x] Twilio template integration with plain-text fallbacks
- [x] Product deduplication (cheapest variant per name)
- [x] Template variables use `product_N` format (not numeric keys)
- [x] Webhook parity replay harness captures async transport
- [x] Comprehensive test coverage (dedup, rate limit, menu, atomic consume, templates)
- [x] Fixtures for inventory-qa, order-creation, confirm-cancel
- [x] All migrations provided and tested
- [x] Documentation updated for replay harness and env vars
