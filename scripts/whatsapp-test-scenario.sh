#!/bin/bash

# WhatsApp Local Test Scenario
# Tests complete order flow: greeting → product query → confirmation

set -e

PORT=5173
WEBHOOK_URL="http://localhost:$PORT/api/whatsapp"
AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-test-token-12345}"
PHONE="+34675167719"
NAME="Test User"

echo "═══════════════════════════════════════════════════════════"
echo "WhatsApp Flow Test Scenario"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Function to compute Twilio signature
compute_signature() {
  local url="$1"
  local params="$2"
  echo -n "${url}${params}" | openssl dgst -sha1 -hmac "$AUTH_TOKEN" -binary | base64
}

# Function to send message to webhook
send_message() {
  local message="$1"
  local button_payload="${2:-}"

  echo "📤 Sending: \"$message\""

  # Build params
  local params="From=whatsapp:${PHONE}"
  params="${params}&To=whatsapp:%2B1234567890"
  params="${params}&Body=${message// /%20}"
  params="${params}&ProfileName=${NAME// /%20}"
  params="${params}&MessageSid=SM$(date +%s)$(shuf -i 100000-999999 -n 1)"

  if [ -n "$button_payload" ]; then
    params="${params}&ButtonPayload=$button_payload"
  fi

  # Compute signature with sorted params
  local url_for_sig="${WEBHOOK_URL}?"
  local param_string="ButtonPayload=${button_payload}&Body=${message// /%20}&From=whatsapp:${PHONE}&MessageSid=SM$(date +%s)&ProfileName=${NAME// /%20}&To=whatsapp:%2B1234567890"

  # For simplicity, use curl which handles URL encoding
  local response=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "x-twilio-signature: test-signature" \
    -H "x-forwarded-host: localhost:5173" \
    -H "x-forwarded-proto: http" \
    -d "From=whatsapp:${PHONE}&To=whatsapp:%2B1234567890&Body=${message}&ProfileName=${NAME}&MessageSid=SM$(date +%s)&ButtonPayload=${button_payload}")

  # Extract message from TwiML
  if echo "$response" | grep -q "<Message>"; then
    local msg=$(echo "$response" | sed -n 's/.*<Message>\(.*\)<\/Message>.*/\1/p' | head -1)
    if [ -n "$msg" ]; then
      echo "🤖 TwiML Response: $msg"
    else
      echo "📨 [Template message with buttons]"
    fi
  else
    echo "⚠️  Response: $(echo $response | cut -c1-100)..."
  fi

  echo ""
  sleep 2
}

echo "Checking dev server..."
if ! nc -z localhost $PORT 2>/dev/null; then
  echo "❌ Dev server not running on port $PORT"
  echo "Start it with: pnpm dev"
  exit 1
fi

echo "✅ Dev server running"
echo ""

# Test scenario
echo "═══════════════════════════════════════════════════════════"
echo "SCENARIO: Complete Order Flow"
echo "═══════════════════════════════════════════════════════════"
echo ""

send_message "salut"
send_message "aveti lapte?"
send_message "da, vreu sa comand carne"
send_message "voi CRENVURSTI URSULET FILLETTI la pretul cel mai mic"

echo "═══════════════════════════════════════════════════════════"
echo "✅ Test Complete"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Check Vercel logs for:"
echo "   - '[whatsapp] starting async reply...'"
echo "   - '[whatsapp] REST reply sent'"
echo "   - '[whatsapp] order creation failed' (if issues)"
