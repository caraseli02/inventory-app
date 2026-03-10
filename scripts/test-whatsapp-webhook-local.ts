#!/usr/bin/env tsx

/**
 * Local WhatsApp webhook test — simulates incoming Twilio message
 *
 * Usage:
 *   pnpm tsx scripts/test-whatsapp-webhook-local.ts
 *
 * This script:
 * 1. Starts the dev server on http://localhost:5173
 * 2. Calls the webhook with a test message
 * 3. Captures the TwiML response
 * 4. Waits for async REST follow-up
 * 5. Shows what should happen vs what actually happened
 */

import crypto from 'node:crypto';

// Twilio signature computation
function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort();

  let data = url;
  for (const key of sortedKeys) {
    data += key + String(params[key]);
  }

  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

async function testWebhook() {
  console.log('🧪 Testing WhatsApp webhook locally...\n');

  // Check environment
  const authToken = process.env.TWILIO_AUTH_TOKEN || 'test-token-12345';
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const fromNumber = process.env.TWILIO_FROM_NUMBER || '';

  console.log('📋 Configuration:');
  console.log(`   TWILIO_AUTH_TOKEN: ${authToken.slice(0, 10)}...`);
  console.log(`   TWILIO_ACCOUNT_SID: ${accountSid || '❌ NOT SET'}`);
  console.log(`   TWILIO_FROM_NUMBER: ${fromNumber || '❌ NOT SET'}`);
  console.log('');

  if (!accountSid || !fromNumber) {
    console.log('⚠️  REST credentials not set. Webhook will only return TwiML ack (no follow-up).');
    console.log('   Set these env vars to test full flow:');
    console.log('   export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx');
    console.log('   export TWILIO_FROM_NUMBER=whatsapp:+xxxxxxxx');
    console.log('');
  }

  // Test message
  const phone = '+40712345678';
  const params = {
    From: `whatsapp:${phone}`,
    To: 'whatsapp:+1234567890',
    Body: 'aveti lapte?',
    ProfileName: 'Test User',
    MessageSid: 'SMxxxxxxxxxxxxxxxxxxxxxxxx',
  };

  const url = 'http://localhost:5173/api/whatsapp';
  const signature = computeTwilioSignature(authToken, url, params);

  console.log('📤 Sending test message:');
  console.log(`   From: ${params.From}`);
  console.log(`   Body: "${params.Body}"`);
  console.log('');

  try {
    // Call the webhook
    const startTime = Date.now();
    console.log('⏳ Calling webhook...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-twilio-signature': signature,
        'x-forwarded-host': 'localhost:5173',
        'x-forwarded-proto': 'http',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const elapsed = Date.now() - startTime;
    const body = await response.text();

    console.log(`✅ Response received in ${elapsed}ms`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log('');

    // Parse TwiML
    if (body.includes('<?xml')) {
      const match = body.match(/<Message>(.*?)<\/Message>/);
      const message = match ? match[1] : 'N/A';
      console.log('📨 TwiML Response:');
      console.log(`   Message: "${message}"`);
      console.log('');

      if (message.includes('⏳')) {
        console.log('✅ Acknowledgment sent (good!)');
      }
    } else {
      console.log('⚠️  Response is not valid TwiML');
      console.log('   Body:', body.slice(0, 200));
    }

    // Wait for async follow-up
    if (accountSid && fromNumber) {
      console.log('⏳ Waiting 5 seconds for async REST follow-up...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log('   (Check Vercel logs for "[whatsapp] REST reply sent" or "[whatsapp] error building reply")');
    }

    console.log('');
    console.log('📊 What should happen:');
    console.log('   1. TwiML ack ("Bună ziua, procesăm..." on first contact) sent immediately');
    console.log('   2. Logs show "[whatsapp] starting async reply..."');
    console.log('   3. Anthropic API called (3-10s)');
    console.log('   4. REST message sent via Twilio');
    console.log('   5. Logs show "[whatsapp] REST reply sent"');
    console.log('');
    console.log('🔍 If follow-up is missing:');
    console.log('   - Check Vercel logs for errors');
    console.log('   - Verify ANTHROPIC_API_KEY is set');
    console.log('   - Verify TWILIO credentials are correct');
    console.log('   - Check Supabase connection');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

testWebhook().catch(console.error);
