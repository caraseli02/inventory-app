## Prevention Strategies

### For MessageSid Deduplication Bugs

**Best Practices**:
- Always check `processed_message_sids` table before processing webhook payloads
- Use upsert-with-conflict semantics: insert fails silently if MessageSid already exists
- Fail open on DB errors — allow message through rather than blocking on timeout
- Log all dedup hits at INFO level for monitoring duplicate retries
- Test with Twilio's automatic webhook retry behavior (Twilio retries 3x with 5s backoff)

**Implementation Pattern** (`lib/whatsapp/dedup.ts`):
```typescript
// Detect duplicates via conflict detection, not explicit lookup
const { data } = await sb.from('processed_message_sids')
  .upsert({ message_sid: messageSid, processed_at: now }, { onConflict: 'message_sid' })
  .select('message_sid');

// Empty array = conflict occurred = duplicate
return Array.isArray(data) && data.length === 0;
```

**Regression Coverage**:
- Test with same MessageSid sent twice in sequence
- Test with mixed time order (delayed second attempt)
- Test with DB unavailable — verify fail-open behavior
- Verify `processed_at` timestamp is updated correctly for monitoring

### For Rate Limit Abuse & LLM Cost Spikes

**Best Practices**:
- Per-phone window-based counting (60s sliding window, 10 msg/window max)
- Increment counter before checking — avoids TOCTOU race on boundary
- Return user-friendly error message in Romanian/English blend for rate-limited users
- Fail open on DB errors — don't block legitimate traffic on infrastructure blips
- Monitor rate limit rejections as cost-control signal

**Implementation Pattern** (`lib/whatsapp/rate-limit.ts`):
```typescript
// Window boundary check
if (!existing || existing.window_start < windowCutoff) {
  // Fresh window — reset counter
  await sb.from('whatsapp_rate_limits').upsert({ count: 1, window_start: now });
  return { allowed: true };
}

// Increment and check threshold
const newCount = existing.message_count + 1;
await sb.from('whatsapp_rate_limits').update({ message_count: newCount });
return { allowed: newCount <= RATE_LIMIT_MAX_MESSAGES }; // Block on 11th
```

**Regression Coverage**:
- 10 consecutive messages within 60s — all allowed
- 11th message within same window — rejected
- Message after window expires — counter resets
- DB unavailable — verify fail-open (allowed: true)
- Window boundary conditions (message at 59s vs 61s)

### For Menu Scan Window Interference

**Best Practices**:
- Limit menu extraction to last 2 assistant messages in conversation
- Prefer current-turn product selection (from `pending_selection`) over old menu state
- Clear `pending_selection` after menu item is selected to prevent stale resurrection
- Log every menu extraction with message count and timestamp for debugging
- Never resurrect menu options from messages older than 2 turns

**Implementation Pattern** (`lib/whatsapp/llm.ts`):
```typescript
// Extract menu only from recent assistant messages
const recentMessages = messages.filter(m => m.role === 'assistant').slice(-2);
const extractedMenus = recentMessages
  .flatMap(msg => extractMenuOptionsFromAssistantText(msg.content));

// Prefer current-turn evidence
const pendingSelection = await getPendingProductSelection(sb, phone);
if (pendingSelection?.selection_type === 'product_list') {
  return pendingSelection.items; // Use stored menu, not extracted
}
```

**Regression Coverage**:
- Menu extracted from message 5 turns back — should be ignored
- Multiple menu options in conversation — only last 2 messages scanned
- Menu cleared after selection — verify stale menu not resurrected on follow-up
- Current turn has no menu but older turn had one — use stored `pending_selection` only

### For Order Confirmation Race Conditions

**Best Practices**:
- Use atomic RPC with FOR UPDATE lock to prevent double-confirm
- RPC path: `consume_pending_order(phone)` reads + clears in single transaction
- Fallback to non-atomic path only when RPC unavailable (e.g., local dev)
- Log every consume attempt with phone and order details
- Test under concurrent confirm/cancel requests on same phone

**Atomic RPC Pattern** (`supabase/migrations/20260313000003_consume_pending_order_rpc.sql`):
```sql
CREATE OR REPLACE FUNCTION consume_pending_order(p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_order JSONB;
BEGIN
  SELECT pending_order INTO v_order
  FROM conversation_history
  WHERE phone_number = p_phone
  FOR UPDATE;  -- Lock row until transaction commits

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE conversation_history
  SET pending_order = NULL,
      updated_at    = now()
  WHERE phone_number = p_phone;

  RETURN v_order;
END;
$$;
```

**Implementation Fallback** (`lib/whatsapp/conversation-state.ts`):
```typescript
export async function consumePendingOrder(sb, phone) {
  try {
    // Atomic path — try RPC first
    const rpcResult = await sb.rpc('consume_pending_order', { p_phone: phone });
    if (!rpcResult.error && rpcResult.data !== undefined) {
      return toPendingOrderState(rpcResult.data);
    }
  } catch {
    // fall through
  }

  // Fallback for local dev (non-atomic but safe)
  const { data } = await sb
    .from('conversation_history')
    .select('pending_order')
    .eq('phone_number', phone)
    .maybeSingle();

  const order = data?.pending_order;
  if (order) {
    await sb.from('conversation_history')
      .update({ pending_order: null })
      .eq('phone_number', phone);
  }

  return toPendingOrderState(order);
}
```

**Regression Coverage**:
- Two confirm requests arrive simultaneously for same phone
  - First should consume and confirm
  - Second should see nil and return `{ status: 'missing' }`
- Confirm + Cancel requests race
  - First writer wins (either confirm or cancel, not both)
  - Second sees nil and returns appropriate status
- RPC available path vs. fallback path produce same result
- Order state is never read twice by same phone in parallel

### For Template Send Failures & Fallback Handling

**Best Practices**:
- Always send LLM reply text BEFORE confirmation template
- Catch template errors and fall back to plain text DA/NU prompt
- Check for missing ContentSID environment variables before attempting send
- Log every template failure with error code for Twilio debugging
- Test with missing Twilio credentials to verify graceful fallback

**Implementation Pattern** (`lib/whatsapp/webhook.ts`):
```typescript
async function sendPendingOrderConfirmation(args) {
  await storePendingOrder(sb, args.phone, args.pending);

  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';
  if (contentSid) {
    try {
      await sendTemplateMessage(args.from, contentSid, variables);
      console.log('[whatsapp] sent confirmation template');
      return;
    } catch (err) {
      console.warn('[whatsapp] template send failed, falling back to text:', err);
    }
  } else {
    console.warn('[whatsapp] TWILIO_CONFIRM_CONTENT_SID not set — using text fallback');
  }

  // Fallback: plain text DA/NU
  await sendRestMessage(args.from, buildPendingConfirmationText(args.pending));
}
```

**Regression Coverage**:
- ContentSID is empty — should use text fallback (no crash)
- Template send throws network error — should catch and fallback
- Template send succeeds — should not send duplicate text
- Empty variables dict — template should still render (graceful)

### For Simulator/Webhook Parity Divergence

**Best Practices**:
- Replay context captures all transport events (typing, rest message, template)
- Webhook and simulator both write to same `replay-context` AsyncLocalStorage
- Replay captures are stored in `.tmp/whatsapp-replay/{replayId}.jsonl` for inspection
- Compare replay logs between webhook and simulator to detect divergence
- Use replay logs as regression baseline for refactors

**Replay Pattern** (`lib/whatsapp/replay-context.ts`):
```typescript
// Both webhook and simulator call this
export async function appendReplayEvent(event) {
  const replayId = getReplayId();
  if (!replayId) return;

  // Store in .tmp/whatsapp-replay/{replayId}.jsonl
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

// Inspector can compare webhook vs. simulator replays
export async function readReplayCapture(replayId) {
  return raw.split('\n').map(line => JSON.parse(line));
}
```

**Regression Coverage**:
- Webhook and simulator produce identical replay events for same input
- Replay events include all message details (To, ContentSid, variables)
- Replay log survives across multiple round trips in same conversation
- Replays can be used to recreate webhook behavior in isolation

## Test Cases to Maintain

### Regression Tests

#### MessageSid Deduplication
- **test: dedup blocks repeated MessageSid within same webhook call**
  - Send same MessageSid twice
  - First should process normally
  - Second should return early as duplicate
  - Verify only one DB write occurs

- **test: dedup allows different MessageSids**
  - Send two distinct MessageSids
  - Both should process without blocking
  - Verify both stored in `processed_message_sids`

- **test: dedup fail-open on DB error**
  - Mock DB error in upsert
  - Webhook should continue processing (return false for duplicate check)
  - Verify console.warn logged for operator visibility

#### Per-Phone Rate Limiting
- **test: allow up to 10 messages in 60s window**
  - Send 10 messages from same phone within window
  - All should be allowed
  - Verify final message_count is 10

- **test: block 11th message in same window**
  - Send 11 messages from same phone within 60s
  - First 10 allowed, 11th rejected
  - Verify response includes rate limit message

- **test: reset counter after window expires**
  - Send 10 messages, wait 61s
  - Next message should be allowed (window reset)
  - Verify message_count is 1, not 11

- **test: per-phone isolation**
  - Send 10 messages from phone A, 5 from phone B within same window
  - Both within limits
  - Phone B should allow 5 more without blocking

- **test: rate limit fail-open on DB error**
  - Mock DB error in checkRateLimit
  - Webhook should allow message through
  - Verify console.warn logged

#### Menu Scan Window Limiting
- **test: extract menu only from last 2 assistant messages**
  - Build conversation with 5 assistant messages, all with menus
  - Extract should only consider messages 4 and 5
  - Verify extracted options don't include messages 1-3

- **test: prefer pending_selection over extracted menu**
  - Assistant responds with new menu
  - pending_selection already has old menu
  - Should use pending_selection, not extracted menu

- **test: stale menu not resurrected after selection**
  - User selects from category list
  - pending_selection cleared
  - Follow-up message with no fresh menu
  - Should not resurrect old category menu

#### Atomic Order Consume
- **test: concurrent confirm/cancel on same phone**
  - Simultaneously send confirm and cancel for same phone
  - Only one should succeed (either confirmed or cancelled, not both)
  - Second should see nil order and return appropriate status

- **test: double-confirm prevented**
  - Send two confirm requests to same phone
  - First creates order and clears pending_order
  - Second sees nil and returns `{ status: 'missing' }`
  - Only one order created in DB

- **test: RPC atomic path vs. fallback produce same result**
  - Run test with RPC available and unavailable
  - Behavior should be identical (except timing)
  - Both should prevent double-confirm

#### Template Send Failures
- **test: template fallback on missing ContentSID**
  - Set TWILIO_CONFIRM_CONTENT_SID to empty
  - Should send text DA/NU fallback
  - Verify no exception thrown

- **test: template fallback on send error**
  - Mock sendTemplateMessage to throw error
  - Should catch and fallback to text
  - Verify both not sent (no duplicate)

- **test: both template paths use same pending_order state**
  - Template succeeds for user A, fails for user B
  - Both should have order stored in pending_order
  - Confirmation status should be independent

### Fixture Scenarios

All fixtures should be runnable via `pnpm whatsapp:replay {fixtureName}` to verify webhook/simulator parity.

#### inventory-qa.json
**Scenario**: Fresh browse, product search, inventory check
- User sends "browse"
- Bot returns category list
- User selects category "Lactate"
- Bot returns product list
- User selects product "Lapte integral"
- Bot returns price and stock
- User sends "confirma" intent

**Assertions**:
- Category list should contain "Lactate"
- Product list should not have duplicates
- Stock quantity matches DB inventory
- Reply includes EUR price format

#### order-creation.json
**Scenario**: Full order workflow from intent to pending
- User sends "doresc lapte integral, 2x"
- LLM extracts order with qty=2
- Bot replies with pending order text
- Pending order stored with pending_order_created_at
- Confirms via "DA"
- Order created in orders table

**Assertions**:
- pending_order has all fields: items, total_price, pickup_time
- pending_order_created_at is set
- Order number generated
- Order status is 'pending'

#### confirm-cancel.json
**Scenario**: Atomic confirm/cancel transitions
- Pending order exists for phone
- User sends "DA" (confirm)
- Order confirmed, pending_order cleared
- Follow-up "DA" returns `{ status: 'missing' }`

- New order pending
- User sends "NU" (cancel)
- Order cancelled, pending_order cleared
- No order created

**Assertions**:
- First confirm succeeds with order_number
- Second confirm returns missing status
- Cancel leaves no order in DB
- Rate limit not triggered by repeated confirm attempts

#### menu-scan-window.json
**Scenario**: Menu extraction doesn't cross window boundaries
- Assistant: "Categorii: 1) Lactate 2) Carnuri..."
- User: "1"
- Assistant: "Produse: 1) Lapte 2) Brânză..."
- User: "1"
- Assistant: "Selectai cantitate..."
- User sends follow-up with typo: "2x1" (invalid)
- Bot doesn't resurrect old category menu

**Assertions**:
- pending_selection updated after each selection
- Menu not extracted from older assistant messages
- Follow-up without fresh menu doesn't trigger old menu

### Minimum Regression Set for WhatsApp Changes

Run before merging any PR touching `lib/whatsapp/`, `api/whatsapp.ts`, `api/whatsapp-simulate.ts`, or Orders confirmation paths:

```bash
pnpm vitest run \
  tests/unit/api/whatsapp-conversation-state.test.ts \
  tests/unit/api/whatsapp-webhook.test.ts \
  tests/unit/whatsappAgent.test.ts \
  tests/unit/whatsapp-rate-limit.test.ts \
  tests/unit/whatsappInventory.test.ts
```

Must pass before PR merge.

## Monitoring & Alerting

### Key Metrics to Track

#### MessageSid Deduplication
- **Metric**: `whatsapp.dedup.hits_per_hour`
  - Count of duplicate MessageSids detected
  - Alert if > 5 per hour (indicates Twilio retry storm or webhook duplicate delivery)
  - Track by hour for anomaly detection

- **Metric**: `whatsapp.dedup.db_errors_per_hour`
  - Count of dedup DB errors
  - Alert if > 2 per hour (DB availability issue)
  - Includes fail-open bypasses

#### Per-Phone Rate Limiting
- **Metric**: `whatsapp.rate_limit.rejections_per_hour`
  - Count of rate-limited users (blocked on 11th message)
  - Alert if > 10 per hour (potential abuse or high volume legitimate spike)
  - Track distinct phone_numbers to identify repeat offenders

- **Metric**: `whatsapp.rate_limit.window_resets_per_hour`
  - Count of 60s windows expiring per phone
  - Monitor for normal traffic patterns

#### Order Confirmation Atomicity
- **Metric**: `whatsapp.orders.consumed_via_rpc`
  - Count of successful RPC consume calls
  - Should be nearly 100% of all order confirmations

- **Metric**: `whatsapp.orders.fallback_consumed`
  - Count of fallback non-atomic consume paths
  - Alert if > 0 in production (indicates RPC failure)

- **Metric**: `whatsapp.orders.double_confirm_attempts`
  - Count of consume calls returning `{ status: 'missing' }` on duplicate confirm
  - Alert if > 3 per hour (potential bot loop or user confusion)

- **Metric**: `whatsapp.orders.confirmation_latency_ms`
  - P50, P95, P99 latency for order confirm flow
  - Alert if P99 > 2000ms (includes RPC timeout)

#### Template Send Success
- **Metric**: `whatsapp.templates.send_success_rate`
  - Ratio of successful template sends to attempts
  - Alert if < 95% (Twilio delivery or config issue)

- **Metric**: `whatsapp.templates.fallback_sends`
  - Count of text fallbacks triggered by template failure
  - Alert if > 5% of confirmation flows

- **Metric**: `whatsapp.templates.missing_sid_fallbacks`
  - Count of fallbacks due to missing ContentSID env var
  - Alert if > 0 (config issue)

#### Menu Extraction & Selection
- **Metric**: `whatsapp.menu.extractions_per_conversation`
  - Average number of menu extractions per phone conversation
  - Baseline for detecting extraction runaway

- **Metric**: `whatsapp.menu.stale_selections`
  - Count of product selections from menu older than 2 turns
  - Alert if > 0 (window limiting not working)

- **Metric**: `whatsapp.pending_selection.expired`
  - Count of pending_selections older than TTL
  - Monitor for cleanup

#### Conversation State Integrity
- **Metric**: `whatsapp.conversation.messages_per_phone`
  - Average message count per phone (histogram)
  - Alert if > 1000 (possible spam/test account)

- **Metric**: `whatsapp.conversation.pending_order_expiry_rate`
  - Count of pending orders aged past TTL without confirmation
  - Normal baseline is ~30% of all pending orders

- **Metric**: `whatsapp.conversation.language_detection_accuracy`
  - Ratio of correct language detection
  - Track EN vs. RO splits

### Alerting Rules

**CRITICAL (page on-call)**:
- Rate limit DB errors > 2/hour (availability)
- Order consume fallback path triggered in production (RPC failure)
- Template send success < 90% (Twilio outage)

**HIGH (Slack alert)**:
- MessageSid dedup hits > 5/hour (webhook retry storm)
- Rate limit rejections > 10/hour (abuse or spike)
- Double confirm attempts > 3/hour (potential bot loop)
- Stale menu selections > 0 (logic bug)

**MEDIUM (daily digest)**:
- Template fallbacks > 5% of confirmations
- Pending order expiry > 50% of total pending
- Message count per phone > 500

**INFORMATIONAL (logging)**:
- Every dedup hit: `[whatsapp] dedup hit: messageSid={sid}, phone={phone}`
- Every rate limit: `[whatsapp] rate limit rejected: phone={phone}, count={count}`
- Every consume: `[whatsapp] order consumed via {rpc|fallback}: phone={phone}, status={status}`
- Every template fallback: `[whatsapp] template fallback: reason={missing_sid|send_error}, error={err}`

### Dashboard Items

**Grafana Panels** (per environment):
1. Dedup hits timeline (hourly)
2. Rate limit rejections by phone (heatmap)
3. Order confirmation latency (P50/P95/P99)
4. Template success rate %
5. RPC consume vs. fallback ratio
6. Conversation messages per phone histogram
7. Pending order expiry distribution

**CloudWatch Logs Insights** (AWS):
```sql
fields @timestamp, phone_number, status, @message
| filter @message like /\[whatsapp\]/
| stats count() as total, count(status="missing") as missing by phone_number
| sort total desc
| limit 100
```

### On-Call Runbook Triggers

**MessageSid Dedup Storm (> 5 hits/hour)**:
1. Check Twilio webhook delivery logs for duplicates
2. Verify no recent deploy broke idempotency
3. Check `processed_message_sids` table age (run cleanup if > 1M rows)
4. Increase monitoring to 5-min intervals

**Rate Limit Spike (> 10 rejections/hour)**:
1. Identify top abusing phone numbers
2. Check if legitimate high-volume customer or bot
3. Consider temporary phone blocklist if malicious
4. Review conversation_history for spam patterns

**Order Consume Fallback (any in production)**:
1. CRITICAL: RPC is down or unavailable
2. Check Supabase Edge Function logs
3. Verify migrations ran (consume_pending_order function exists)
4. Fallback is non-atomic; risk of double-confirm — monitor double-confirm metric
5. Scale down traffic until fixed

**Template Send Failure (< 95% success)**:
1. Check Twilio API status page
2. Verify `TWILIO_CONFIRM_CONTENT_SID` (confirmation) and `TWILIO_WELCOME_CONTENT_SID`/`TWILIO_WELCOME_SID` (welcome) are set
3. Check if variables format changed (look for Twilio error 21656)
4. Fallback text is working; UX degraded but functional

### Log Aggregation Patterns

All logs prefixed with `[whatsapp]` for easy grep:

```bash
# View all WhatsApp logs
grep '\[whatsapp\]' /var/log/app.log | tail -100

# Specific phone debugging
grep 'phone=+40123456789' /var/log/app.log | tail -50

# Track single order confirmation flow
grep 'orderNumber=ON-2026-003' /var/log/app.log
```
