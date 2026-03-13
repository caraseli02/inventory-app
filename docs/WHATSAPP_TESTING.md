# WhatsApp Agent Local Testing Guide

**Goal**: test real WhatsApp behavior locally before deploying to Vercel preview.

---

## Setup (5 minutes)

### 1. Copy env file
```bash
cp .env.example .env
```

### 2. Fill in required variables
```bash
# Database (Supabase)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# AI (use Anthropic for local testing)
ANTHROPIC_API_KEY=sk-ant-...

# Twilio (for signature validation + REST)
TWILIO_AUTH_TOKEN=auth_token_here
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_FROM_NUMBER=+14015551234

# Optional: Store info
STORE_NAME=Magazinul Verde
STORE_ADDRESS=Str. Florilor 12, Cluj-Napoca
STORE_HOURS=Luni-Vineri 8-20, Sâmbătă 9-18

# New: Order confirmation button template (Step 4)
TWILIO_CONFIRM_CONTENT_SID=HX43f3620013aa95ed4a4df971f9e2f52f
```

### 3. Start development server
```bash
pnpm dev
```

The simulator will be available at: `http://localhost:5173/api/whatsapp-simulate`

---

## Testing Methods

### Option 1: Fixture-backed webhook replay (Recommended)
```bash
pnpm whatsapp:replay --list
pnpm whatsapp:replay --fixture inventory-qa
pnpm whatsapp:replay --fixture order-creation
pnpm whatsapp:replay --fixture confirm-cancel
```

This is the authoritative local parity path:
- sends Twilio-shaped requests to local `/api/whatsapp`
- signs them like real webhook traffic
- replays multi-turn scenarios from saved fixtures
- captures async REST/template transport events from the real webhook flow
- exercises the real webhook logic instead of simulator-only branches

**Pros**: closest local path to real phone behavior, reproducible, fixture-backed
**Cons**: fixtures may need product-name edits to match your local inventory

---

### Option 2: Interactive real-webhook chat
```bash
pnpm whatsapp:test
```

This talks to the real `/api/whatsapp` handler locally:
- Type free-form messages
- See immediate TwiML responses
- Exercise the async REST follow-up path
- Simulate button-confirm / cancel flows through the real webhook logic

**Pros**: flexible for ad hoc exploration
**Cons**: not fixture-backed, harder to compare runs

---

### Option 3: Automated Integration Tests
```bash
pnpm whatsapp:test:all
```

Runs full test suite with vitest:
- ✅ 30+ test cases covering all features
- ✅ Edge cases (empty messages, Unicode, long text)
- ✅ Error handling
- ✅ Inventory context merging

**Pros**: Comprehensive, automated, good for CI
**Cons**: Less interactive, harder to debug individual cases

---

### Option 4: Simulator-only local testing
```bash
# Single product query
curl -X POST http://localhost:5173/api/whatsapp-simulate \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+40123456789",
    "name": "Test User",
    "text": "Aveti lapte?",
    "debug": true
  }'

# Reset conversation history
curl -X POST http://localhost:5173/api/whatsapp-simulate \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+40123456789",
    "reset": true
  }'

# Create order
curl -X POST http://localhost:5173/api/whatsapp-simulate \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+40123456789",
    "name": "Ion",
    "text": "Vreau 2 lapte maine 12:00",
    "debug": true
  }'
```

**Pros**: convenient for local experimentation
**Cons**: not the source of truth for phone parity

---

## Feature Testing Checklist

### ✅ Feature 1: Product Q&A
```
Test cases:
□ Aveti lapte?                  → Should show stock & price in EUR
□ Cat costa zaharul?            → Should show price with €
□ Aveti caviar?                 → Should handle out-of-stock
□ Do you have milk?             → English response
```

**Expected**: Reply mentions product, shows price (€), indicates stock level

---

### ✅ Feature 2: Order Creation
```
Test cases:
□ Vreau 2 lapte maine 12:00     → Creates order with qty, date, time
□ Vreau 1 paine maine 14:30    → Different product
□ Vreau 2 branza maine 11      → Handles bare hour
```

**Expected**: Reply shows product name, quantity, price (€), pickup time

---

### ✅ Feature 3: Multi-Turn Context
```
Test cases (run in sequence):
□ Turn 1: Aveti lapte?
□ Turn 2: Vreau 2, maine 15:00
  → Should remember "lapte" from Turn 1
□ Turn 3: Cat costa?
  → Should respond about the milk from Turn 1-2
```

**Expected**: Bot references earlier messages (e.g., "2x lapte" in Turn 2)

---

### ✅ Feature 4: Natural Date Parsing
```
Test cases:
□ maine 10:00                   → Normalizes to "mâine 10:00"
□ vineri 14:00                  → Recognizes day names
□ maine la 10.30                → Converts dot to colon
□ maine la 14                   → Handles bare hour → "14:00"
```

**Expected**: All dates standardized to "mâine/vineri/etc HH:MM" format

---

### ✅ Feature 5: Cancellation Intent
```
Test sequence:
1. Create order: Vreau 2 lapte maine 12:00
2. Cancel variations:
□ Anuleaza comanda!             → Detects cancel
□ Nu mai vreau                  → Detects cancel
□ Anulez                        → Detects cancel
```

**Expected**: Bot responds with cancellation confirmation

---

### ✅ Feature 6: Store Info
```
Test cases:
□ Care e adresa?                → Shows STORE_ADDRESS from env
□ Care e programul?             → Shows STORE_HOURS from env
□ Ce numar aveti?               → Shows STORE_PHONE (optional)
```

**Expected**: Real store info from env vars (not placeholders)

---

## Debugging Tips

### View full debug info
```bash
pnpm whatsapp:replay --fixture inventory-qa
pnpm whatsapp:test
```

Or with curl + `"debug": true`:
```json
{
  "ok": true,
  "reply": "...",
  "debug": {
    "intent": "product_query",
    "searchCandidatesUsed": ["lapte"]
  }
}
```

### Check conversation history
```typescript
// In whatsapp.ts, getHistory() retrieves from conversation_history table
// To reset: POST /api/whatsapp-simulate with {"reset": true, "phone": "+40..."}
```

### Verify database connection
```bash
# Make sure Supabase is running and accessible
# Check SUPABASE_URL and SUPABASE_ANON_KEY in .env

# Test connection:
curl https://your-project.supabase.co/rest/v1/orders?select=count -H "apikey: YOUR_ANON_KEY"
```

### Check Anthropic API
```bash
# Make sure ANTHROPIC_API_KEY is valid
# Check console logs: "Claude Haiku responded with..."

# If you see timeouts, check:
# - Network connectivity
# - API key validity (sk-ant-...)
# - Rate limits (15k+ tokens/min for Haiku)
```

---

## Common Issues & Fixes

### "Replay failed: fetch failed"
**Cause**: Dev server not running or wrong base URL
**Fix**:
```bash
pnpm dev  # Start dev server
# Verify it's running on http://localhost:5173
```

If needed:
```bash
WHATSAPP_REPLAY_BASE_URL=http://localhost:4173 pnpm whatsapp:replay --fixture inventory-qa
```

### "Supabase not configured"
**Cause**: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env
**Fix**:
```bash
# Copy real values from Supabase dashboard
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### "Anthropic API error"
**Cause**: Missing or invalid ANTHROPIC_API_KEY
**Fix**:
```bash
# Get valid key from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-v0-...
```

### "Product not found" on every query
**Cause**: Inventory table empty or products not inserted
**Fix**:
```bash
# Check Supabase → products table
# Insert test products via Vercel OR via inventory app
```

### Order doesn't create (no ORDER: in reply)
**Cause**: LLM didn't generate ORDER: directive
**Fix**:
- Check that Claude is being called (not local fallback)
- Verify `repairOrder: true` is enabled in code
- Check logs: "maybeRepairOrderReply..." should appear

### Conversation history not preserved
**Cause**: Redis connection lost or conversation_history table missing
**Fix**:
```bash
# Verify migration ran:
# supabase db reset  (local)
# OR check Supabase UI → SQL Editor → conversation_history table exists
```

---

## After Testing Locally

### 1. All 6 features working? ✅
- [ ] Product Q&A
- [ ] Order creation
- [ ] Multi-turn context
- [ ] Natural dates
- [ ] Cancellation
- [ ] Store info

### 2. Ready to deploy to Vercel preview?
```bash
# Create PR (already done: #156)
# Vercel auto-deploys preview
# Set env vars in Vercel preview
# Update Twilio webhook to preview URL
# Test in preview
```

### 3. After preview testing, merge to main
```bash
# Click "Merge" in PR #156
# Vercel deploys to production
# Update Twilio webhook to production URL
```

---

## Quick Reference

| Feature | Test Command | Expected Result |
|---------|--------------|-----------------|
| Product Q&A | `Aveti lapte?` | Shows stock + EUR price |
| Order Create | `Vreau 2 lapte maine 12:00` | Order with total price |
| Multi-turn | `Aveti lapte?` then `Vreau 2, maine 15:00` | Remembers milk |
| Natural dates | `maine la 10.30` | Shows "mâine 10:30" |
| Cancel | `Anuleaza` | Confirms cancellation |
| Store info | `Care e adresa?` | Shows real address |

---

## Files Involved

**Production**:
- `api/whatsapp.ts` (1,631 lines) — Main agent

**Testing**:
- `scripts/whatsapp-replay.ts` — Fixture-backed real-webhook parity replay
- `scripts/whatsapp-local-test.ts` — Interactive real-webhook local test
- `scripts/test-whatsapp-webhook-local.ts` — One-shot webhook smoke test
- `tests/integration/whatsapp-agent.test.ts` — Automated tests

**Configuration**:
- `docs/whatsapp_agent_overview.md` — Architecture
- `docs/WHATSAPP_TESTING.md` — This file
- `.env` — Local secrets (gitignored)
