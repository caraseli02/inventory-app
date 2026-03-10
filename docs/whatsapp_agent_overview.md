# WhatsApp AI Agent — Complete Overview

**Last Updated**: 2026-03-10
**File Size**: `api/whatsapp.ts` = 1,631 lines (refactoring planned)

---

## What We've Built (March 2026)

A complete WhatsApp AI assistant that handles:
1. ✅ Product availability Q&A (stock, price, category)
2. ✅ Multi-turn conversation with history
3. ✅ Pickup order creation with AI
4. ✅ Order confirmation with Quick Reply buttons
5. ✅ Store info (hours, address, contact)
6. ✅ Natural date parsing (tomorrow, friday, etc.)
7. ✅ Order cancellation
8. ✅ Typing indicators + bold formatting
9. ✅ Two-message acknowledgment pattern (REST API split)

---

## Architecture

```
Customer (WhatsApp)
  ↓ message
Twilio Sandbox Webhook
  ↓
POST /api/whatsapp (1,631 lines)
  ├─ TwilioBody: From, Body, ButtonPayload, ProfileName...
  ├─ Signature validation (security)
  ├─ Intent classification (product_query | browse | cancel | store_info)
  │
  ├─ Button handling (if ButtonPayload)
  │  ├─ confirm → insert order to DB
  │  └─ cancel → discard pending order
  │
  ├─ Message handling (if text Body)
  │  ├─ Send acknowledgment via TwiML
  │  ├─ Send typing indicator (fire-and-forget)
  │  └─ buildReplyWithPending(phone, name, text)
  │      ├─ getHistory() from conversation_history table
  │      ├─ runConversationTurn() [shared for simulator + production]
  │      │  ├─ classifyIncomingText()
  │      │  ├─ getInventorySummary() [smart candidate selection]
  │      │  ├─ Claude Haiku API call
  │      │  ├─ maybeRepairOrderReply() [fallback ORDER: generation]
  │      │  └─ processOrderIntent()
  │      │     ├─ extractOrderJson() [brace-depth counter]
  │      │     ├─ resolveOrderItems() [match products, check stock]
  │      │     └─ return {reply, pending} ← NEW (Step 4)
  │      └─ appendHistory()
  │
  └─ Send reply via REST API
     ├─ If pending order + contentSid:
     │  ├─ storePendingOrder() [conversation_history.pending_order]
     │  └─ sendTemplateMessage() [Quick Reply buttons] ← NEW (Step 4)
     └─ Else:
        └─ sendRestMessage() [text response]
```

---

## Key Functions & Recent Work

### Step 1: Typing Indicator (2026-03-10)
```typescript
async function sendTypingIndicator(messageSid: string)
  → Twilio Public Beta API
  → Shows "typing..." animation + marks as read
  → Fire-and-forget (non-critical)
```

### Step 2: Two-Message Acknowledgment (2026-03-10)
```typescript
// Webhook returns immediately with acknowledgment
res.status(200).send(twiml("⏳ Am primit, procesăm..."))

// Then builds real reply async + sends via REST
buildReplyWithPending(phone, name, text)
  .then(async (result) => sendRestMessage(...))
```

### Step 3: Bold Formatting (2026-03-10)
```typescript
// System prompt rule 5:
"Folosește *bold* (asteriscuri) pentru date cheie:
 număr comandă, preț total, oră ridicare, denumire produs"

// Example output:
"*2x LAPTE — €6.84*
 Ridicare: *mâine 12:00*"
```

### Step 4: Quick Reply Order Confirmation (2026-03-10) 🆕
```typescript
// 1. Create template in Twilio Console
Template: order_confirmation
ContentSid: HX43f3620013aa95ed4a4df971f9e2f52f
Buttons: [✅ Da, confirmă] [❌ Anulează]

// 2. Store in env var
TWILIO_CONFIRM_CONTENT_SID=HX43f3620013aa95ed4a4df971f9e2f52f

// 3. When order ready:
processOrderIntent() → returns {reply, pending}
sendTemplateMessage(to, contentSid, variables)
storePendingOrder(phone, {items, total_price, pickup_time})

// 4. When button tapped:
ButtonPayload = "confirm" | "cancel"
getPendingOrder(phone) → insert to DB or discard
```

---

## Data Flow Example

### Scenario: Customer orders 2 milk tomorrow at 12:00

**Turn 1:**
```
User: "vreau 2 lapte, maine 12:00"
  ↓
classifyIncomingText() → product_query
getInventorySummary() → search for "lapte"
Claude generates: "
  2x LAPTE CONDEN INTEG ICINEA — €6.84
  Ridicare: mâine 12:00

  ORDER: {
    "customer_name": "Ion",
    "customer_phone": "+40...",
    "items": [{"name": "LAPTE CONDEN INTEG ICINEA", "qty": 2, "unit_price": 3.42}],
    "total_price": 6.84,
    "pickup_time": "mâine 12:00"
  }"
  ↓
processOrderIntent() extracts & validates JSON
  → normalizePickupTime("mâine 12:00") → "mâine 12:00"
  → resolveOrderItems() checks stock ✅
  → return {
      reply: "2x LAPTE CONDEN... €6.84\nRidicare: mâine 12:00",
      pending: {items, total_price, pickup_time, ...}
    }
  ↓
sendTemplateMessage() via REST with variables:
  product_name: "2x LAPTE CONDEN INTEG ICINEA"
  price: "6.84"
  pickup_time: "mâine 12:00"
  ↓
WhatsApp shows:
  "Confirmi această comandă?
   2x LAPTE CONDEN INTEG ICINEA — €6.84
   Ridicare: mâine 12:00
   [✅ Da, confirmă] [❌ Anulează]"

storePendingOrder(phone, {customer_name, items, ...})
  → conversation_history.pending_order = {...}
```

**Turn 2 (button tap):**
```
User: [taps ✅ Da, confirmă]
  ↓
TwilioBody.ButtonPayload = "confirm"
  ↓
getPendingOrder(phone)
  → fetch from conversation_history.pending_order
  → clear it (update to null)
  ↓
INSERT to orders table:
  customer_name, customer_phone, items, total_price, pickup_time, status='confirmed'
  ↓
WhatsApp: "✅ Comanda ORD-025 înregistrată! Te așteptăm."
```

---

## Critical Functions

### Order Intent Processing
```typescript
interface ProcessOrderResult {
  reply: string;
  pending?: PendingOrder;  // ← Step 4: enables button flow
}

async function processOrderIntent(sb, replyText)
  → extractOrderJson()    [brace-depth counter, handles nested JSON]
  → resolveOrderItems()   [product lookup + stock validation]
  → normalizePickupTime() [convert "maine" → "mâine 12:00"]
  → return {reply, pending}  [DON'T insert yet, wait for button]
```

### History Management
```typescript
async function getHistory(phone)
  → fetch from conversation_history
  → expire if >7 days old
  → return last 20 messages

async function appendHistory(phone, history, newMessages)
  → append_conversation_history RPC (optimized)
  → upsert fallback if RPC fails
```

### Intent Classification
```typescript
function classifyIncomingText(text): IncomingIntent
  → Strips JSON blocks first (false-positive fix)
  → cancel_order: matches "anulează|cancel|nu mai vreau"
  → store_info: matches "adresă|unde|contact"
  → browse_inventory: matches "ce aveți|lista"
  → product_query: default (most messages)
```

### Inventory Search
```typescript
function extractSearchCandidates(text)
  → extract product keywords: "lapte" from "vreau lapte"

function extractSearchCandidatesFromHistory(history)
  → scans BOTH user + assistant messages (important!)
  → handles multi-turn context: "da, confirma" still has "lapte"

function getInventorySummary(sb, {intent, candidates})
  → builds formatted inventory text
  → prioritizes candidates
  → shows stock + price + category
```

### Natural Date Parsing
```typescript
function parsePickupDateTime(text)
  → "maine la 12.30"  → "mâine 12:30"
  → "maine"           → null (just date, no time)
  → "vineri 14:00"    → "vineri 14:00"
  → extracts date words + time in HH:MM format

function normalizePickupTime(raw)
  → bare hour "11"    → "11:00"
  → HH:MM "10:30"    → "10:30" (unchanged)
  → calls parsePickupDateTime() for complex formats
```

---

## Environment Variables Required

### Core
```bash
# Webhook signature validation
TWILIO_AUTH_TOKEN=abc123...

# LLM
ANTHROPIC_API_KEY=sk-ant-...

# Database
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### Optional (REST two-message flow)
```bash
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_FROM_NUMBER=+14015551234
```

### Optional (Order confirmation buttons - Step 4)
```bash
TWILIO_CONFIRM_CONTENT_SID=HX43f3620013aa95ed4a4df971f9e2f52f
```

### Optional (Store info in replies)
```bash
STORE_NAME=Magazinul Verde
STORE_ADDRESS=Str. Florilor 12, Cluj-Napoca
STORE_HOURS=Luni-Vineri 8-20, Sâmbătă 9-18
STORE_PHONE=+40 123 456 789
```

---

## File Organization (1,631 lines)

| Section | Lines | Purpose |
|---------|-------|---------|
| Types | 50-70 | TwilioBody, ConversationMessage, WhatsAppSimulatorResult |
| Handler | 96-180 | Main webhook, signature validation, button routing |
| Twilio REST | 191-290 | sendTypingIndicator, sendRestMessage, sendTemplateMessage |
| AI Reply Builder | 300-470 | buildReply, buildReplyWithPending, buildSimulatorReply |
| System Prompt | 574-750 | buildSystemPrompt, language detection, store info injection |
| Conversation Turn | 318-470 | runConversationTurn, intent classification, history |
| Intent Handlers | 750-950 | classifyIncomingText, handleCancellationRequest, maybeRepairOrderReply |
| Order Processing | 1165-1400 | processOrderIntent, extractOrderJson, resolveOrderItems, normalizePickupTime |
| Inventory | 1000-1250 | getInventorySummary, extractSearchCandidates, product matching |
| Pending Orders | 1259-1330 | storePendingOrder, getPendingOrder (NEW) |

---

## Testing Scenarios

### ✅ Working (Tested in session)
1. Single-turn product query: "aveti lapte?" → stock + price
2. Multi-turn context: "da, 2" (quantity confirmation)
3. Order creation: "2 lapte maine 12:00" → ORD-XXX
4. Natural dates: "maine la 10.30" → normalized
5. Order cancellation: "anuleaza" → discard pending
6. Typing indicator: shows "typing..." animation
7. Quick Reply buttons: shows confirmation template
8. Button taps: confirm/cancel orders

### ⚠️ Needs Testing (Preview)
1. Button expiry: pending order older than 1 hour
2. Session timeout: conversation history TTL
3. Inventory edge cases: out of stock handling
4. Language fallback: English vs Romanian
5. Error recovery: malformed JSON in LLM reply

---

## Known Issues & Improvements

### Code Quality
- **File size**: 1,631 lines, should split into modules
  - Suggested: `whatsapp-core.ts`, `whatsapp-intent.ts`, `whatsapp-order.ts`
- **Function overlap**: `maybeRepairOrderReply()` + `processOrderIntent()` both extract orders
- **Test coverage**: Unit tests exist but E2E coverage limited

### Features (Post-MVP)
- [ ] Phase 2: Catalog + List Picker templates
- [ ] Phase 2: Product browsing by category
- [ ] Phase 3: Owner order notifications
- [ ] Phase 3: Customer analytics dashboard

---

## Recent Commits (March 2026)

```
7067e8f feat(whatsapp): Quick Reply order confirmation buttons (Step 4)
1d401df feat(whatsapp): typing indicator, acknowledgment message, bold formatting (Steps 1-3)
3f53dc8 feat(whatsapp): natural dates, cancellation, JSON fix, repair on production
fb66dcc docs(claude): fix claude-progress.md path + add missing command sections
762b53a fix(whatsapp): order creation end-to-end — regex, JSON parsing, history context
a829005 fix(whatsapp): category-aware browse inventory + Supabase diagnostics
```

---

## Next Steps

### Immediate (This Session)
1. ✅ Review architecture (this document)
2. Test in Vercel preview environment
3. Review large-file refactoring strategy
4. Split `api/whatsapp.ts` into modules

### Phase 2 (Post-MVP)
1. Implement Catalog + List Picker templates
2. Add product browsing by category
3. Owner notifications on new orders
4. Customer order history

