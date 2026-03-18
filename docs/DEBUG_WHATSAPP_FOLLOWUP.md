# Debug: WhatsApp Follow-up Message Not Arriving

**Symptom**: User receives ack ("⏳ Am primit, procesăm...") but no follow-up message

## Quick Checklist

### 1. Verify Fix is Deployed ✅

```bash
# Check current code has waitUntil
grep -n "waitUntil" api/whatsapp.ts
# Should show: line 27 import, line 205 usage

# Check vercel.json has maxDuration
grep -A2 "api/whatsapp" vercel.json
# Should show: "maxDuration": 60
```

**Status**: ✅ Code changes confirmed

---

### 2. Check REST Credentials Are Set 🔑

**Problem**: If REST creds missing → only TwiML ack, no follow-up

```bash
# List what's needed:
echo "TWILIO_ACCOUNT_SID: $TWILIO_ACCOUNT_SID"
echo "TWILIO_FROM_NUMBER: $TWILIO_FROM_NUMBER"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
```

**Fix**:
```bash
# In .env (local):
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=whatsapp:+1234567890
ANTHROPIC_API_KEY=sk-ant-xxxxxxx

# In Vercel Dashboard:
# Settings → Environment Variables → add same vars
```

**Status**: ⚠️ **CHECK THIS FIRST**

---

### 3. Test Locally (No Deploy Needed)

```bash
# Terminal 1 - Start dev server
pnpm dev

# Terminal 2 - Run webhook test
pnpm tsx scripts/test-whatsapp-webhook-local.ts
```

**Expected output**:
```
✅ Response received in 150ms
   Status: 200
   Message: "⏳ Am primit, procesăm..."

✅ Acknowledgment sent (good!)

⏳ Waiting 5 seconds for async REST follow-up...
   (Check Vercel logs for "[whatsapp] REST reply sent"...)
```

**Status**: Test and report results

---

### 4. Check Vercel Production Logs

**Option A - CLI**:
```bash
vercel login  # if not already
vercel logs --follow --since 30m -- --function api/whatsapp
```

**Option B - Dashboard**:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Logs tab
4. Filter by function: `api/whatsapp`

**Look for these log lines**:
```
[whatsapp] starting async reply...           ← After TwiML sent
[whatsapp] REST reply sent                   ← Success! Follow-up sent
[whatsapp] error building reply: ...         ← AI or DB error
REST send failed: 401 ...                    ← Twilio auth error
```

**Status**: Report what logs you see

---

### 5. If Logs Show Error: "error building reply"

This means `buildReplyWithPending` failed. Check:

```bash
# 1. Anthropic API key
echo "ANTHROPIC_API_KEY set? ${ANTHROPIC_API_KEY:+yes}:${ANTHROPIC_API_KEY:-no}"

# 2. Supabase connection
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:0:10}..."

# 3. Try a direct test
pnpm whatsapp:eval
# This simulates the agent without Twilio/REST, so pinpoints AI issues
```

**Status**: Run these checks

---

### 6. If Logs Show: "REST send failed: 401"

Twilio authentication failed:

```bash
# Check Twilio credentials
echo "TWILIO_AUTH_TOKEN set? ${TWILIO_AUTH_TOKEN:+yes}:${TWILIO_AUTH_TOKEN:-no}"
echo "TWILIO_ACCOUNT_SID: $TWILIO_ACCOUNT_SID"
echo "TWILIO_FROM_NUMBER: $TWILIO_FROM_NUMBER"

# Verify on Twilio Console:
# https://console.twilio.com → Account → Auth Token
```

**Fix**: Copy exact values from Twilio Console → Vercel Environment Variables

**Status**: Check credentials match

---

### 7. If Only TwiML Ack, No Follow-up (No Errors)

This means:
1. TwiML sent ✅
2. waitUntil started ✅
3. Async work running ✅
4. But... no REST message

**Possible causes**:
- Anthropic call taking >10s (timeouts before REST send)
- REST send called but failed silently (no error log)
- Function killed by Vercel despite waitUntil

**Debug**:
```bash
# Add more logging to see what's slow:
# In api/whatsapp.ts around line 207-225:
console.log('[whatsapp] buildReplyWithPending starting...');
const result = await buildReplyWithPending(phone, name, text);
console.log('[whatsapp] buildReplyWithPending done, result:', result.reply.slice(0, 50));

# Redeploy and check logs for timing
```

**Status**: Try adding debug logs

---

## Complete Debug Flow

1. ✅ **Verify fix is in code** → `grep waitUntil api/whatsapp.ts`
2. 🔑 **Check environment variables** → All 5 Twilio + Anthropic + Supabase vars set?
3. 🧪 **Test locally** → `pnpm dev` + `pnpm tsx scripts/test-whatsapp-webhook-local.ts`
4. 📋 **Check Vercel logs** → Look for "[whatsapp] starting async reply..." and "[whatsapp] REST reply sent"
5. 🔴 **If error log** → Check Anthropic API, Supabase, Twilio credentials
6. 🐢 **If no error but no follow-up** → May be timeout, add debug logging

---

## Quick Test Command

```bash
# Terminal 1
pnpm dev

# Terminal 2 (wait for dev server to start)
sleep 3 && pnpm tsx scripts/test-whatsapp-webhook-local.ts
```

Report back with:
1. Local test output
2. Vercel logs (last 10 lines)
3. Environment variables set? (yes/no for each)
