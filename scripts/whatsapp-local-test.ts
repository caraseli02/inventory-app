#!/usr/bin/env tsx

/**
 * Local WhatsApp Testing — Exact Replica of Real Phone Testing
 *
 * Usage:
 *   pnpm tsx scripts/whatsapp-local-test.ts
 *
 * Interactive testing:
 * 1. Sends test messages/buttons to actual webhook handler
 * 2. Shows TwiML response (immediate)
 * 3. Shows REST follow-up messages (async)
 * 4. Supports full conversation flow
 * 5. Displays templates with variables
 */

import crypto from 'node:crypto';
import * as readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// ─── Twilio Signature Computation ─────────────────────────────────────────

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

// ─── Main Simulation ──────────────────────────────────────────────────────

interface Message {
  type: 'user' | 'bot' | 'template' | 'system';
  text: string;
  isTemplate?: boolean;
  variables?: Record<string, string>;
}

async function runLocalTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  WhatsApp Local Simulator — Real Webhook Testing           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check environment
  const authToken = process.env.TWILIO_AUTH_TOKEN || 'test-token-12345';
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const fromNumber = process.env.TWILIO_FROM_NUMBER || '';
  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID || '';

  console.log('📋 Configuration:');
  console.log(`   ✓ TWILIO_AUTH_TOKEN: ${authToken.slice(0, 10)}...`);
  console.log(`   ${accountSid ? '✓' : '✗'} TWILIO_ACCOUNT_SID: ${accountSid || 'NOT SET'}`);
  console.log(`   ${fromNumber ? '✓' : '✗'} TWILIO_FROM_NUMBER: ${fromNumber || 'NOT SET'}`);
  console.log(`   ${contentSid ? '✓' : '✗'} TWILIO_CONFIRM_CONTENT_SID: ${contentSid || 'NOT SET'}\n`);

  if (!accountSid || !fromNumber) {
    console.log('⚠️  Warning: REST credentials not fully set.');
    console.log('   You can still test TwiML responses but no REST follow-up will be sent.\n');
  }

  // Get user details
  const phone = await question('📱 Phone number (e.g., +40712345678): ');
  const name = await question('👤 Your name (e.g., Vlad): ');
  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  console.log('\n💬 Starting conversation. Type "reset" to clear history, "quit" to exit.\n');

  const conversation: Message[] = [];

  for (;;) {
    const userInput = await question('You: ');

    if (userInput.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!\n');
      break;
    }

    if (userInput.toLowerCase() === 'reset') {
      console.log('🔄 Conversation history cleared.\n');
      conversation.length = 0;
      continue;
    }

    if (!userInput.trim()) {
      continue;
    }

    conversation.push({ type: 'user', text: userInput });

    // Call the webhook
    await testWebhookMessage(
      authToken,
      normalizedPhone,
      name,
      userInput,
      conversation
    );
  }

  rl.close();
}

async function testWebhookMessage(
  authToken: string,
  phone: string,
  name: string,
  text: string,
  conversation: Message[]
): Promise<void> {
  const params: Record<string, string> = {
    From: `whatsapp:${phone}`,
    To: 'whatsapp:+1234567890',
    Body: text,
    ProfileName: name,
    MessageSid: `SM${Date.now()}${Math.random().toString(36).slice(2, 9)}`,
  };

  const url = 'http://localhost:5173/api/whatsapp';
  const signature = computeTwilioSignature(authToken, url, params);

  try {
    console.log('\n⏳ Processing...\n');

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

    if (!response.ok) {
      console.log(`❌ Error: HTTP ${response.status}`);
      const text = await response.text();
      console.log(text.slice(0, 200));
      console.log();
      return;
    }

    const body = await response.text();

    // Parse TwiML response
    if (body.includes('<?xml')) {
      const messageMatch = body.match(/<Message>([\s\S]*?)<\/Message>/);
      const message = messageMatch ? messageMatch[1] : '';

      if (message) {
        console.log(`🤖 Bot: ${message}\n`);
        conversation.push({ type: 'bot', text: message });
      } else {
        console.log('📨 [No message in TwiML response - async processing]\n');
      }

      // Check if this is a template response by looking for ContentSid
      if (body.includes('contentSid') || body.includes('ContentVariables')) {
        console.log('📋 Template message pending (buttons not visible in local test)\n');
        conversation.push({
          type: 'template',
          text: '[Quick Reply Template with buttons]',
        });
      }
    } else {
      console.log('⚠️  Unexpected response format\n');
    }

    // Wait briefly for async REST follow-up logging
    await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.log(`❌ Error: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────

runLocalTest().catch(console.error);
