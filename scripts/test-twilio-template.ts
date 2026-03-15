#!/usr/bin/env tsx
/**
 * Fetch the working list-picker template to understand its structure,
 * then create a dynamic one and compare.
 *
 * Needs: TWILIO_AUTH_TOKEN + either TWILIO_ACCOUNT_SID or we extract from the SID.
 * Usage: pnpm tsx scripts/test-twilio-template.ts
 */
import 'dotenv/config';

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const FROM = process.env.TWILIO_FROM_NUMBER ?? '';
const TO = process.env.WHATSAPP_TEST_PHONE ?? '';
const EXISTING_SID = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

if (!AUTH_TOKEN) {
  console.error('Missing TWILIO_AUTH_TOKEN');
  process.exit(1);
}

// Try to get account SID from the auth — or the user needs to set it
let accountSid = ACCOUNT_SID;

async function findAccountSid(): Promise<string> {
  if (accountSid) return accountSid;
  // Can't derive it — need the user to provide it
  console.error('TWILIO_ACCOUNT_SID not set in .env. Please add it.');
  console.error('Find it at: https://console.twilio.com/ → Account Info');
  process.exit(1);
}

function getAuth(): string {
  return Buffer.from(`${accountSid}:${AUTH_TOKEN}`).toString('base64');
}

async function createContent(itemCount: number): Promise<string | null> {
  // Match the working template format exactly:
  // - trailing space in item text: "{{1}} "
  // - empty description: ""
  // - empty variables: {}
  const items = Array.from({ length: itemCount }, (_, i) => ({
    item: `{{${i + 1}}} `,
    id: `product_${i + 1}`,
    description: '',
  }));

  const payload = {
    friendly_name: `test_list_picker_${itemCount}_${Date.now()}`,
    language: 'ro',
    types: {
      'twilio/list-picker': {
        body: 'Am găsit mai multe produse. Care anume?',
        button: 'Selectează o opțiune',
        items,
      },
    },
    variables: {},
  };

  console.log('\n=== Creating Content (%d items) ===', itemCount);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const resp = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getAuth()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await resp.json();
  console.log('Status:', resp.status);
  console.log(JSON.stringify(body, null, 2));

  if (!resp.ok) return null;
  return (body as { sid?: string }).sid ?? null;
}

async function sendTemplate(contentSid: string, variables: Record<string, string>): Promise<boolean> {
  if (!FROM || !TO) {
    console.log('\n=== SKIPPING send (no FROM/TO) — check Content structure above ===');
    return false;
  }

  const toFormatted = TO.startsWith('whatsapp:') ? TO : `whatsapp:${TO}`;
  const fromFormatted = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;

  const params = new URLSearchParams({
    To: toFormatted,
    From: fromFormatted,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  console.log('\n=== Sending template ===');
  console.log('ContentSid:', contentSid);
  console.log('ContentVariables:', JSON.stringify(variables));

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${getAuth()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  const body = await resp.text();
  console.log('Status:', resp.status);
  console.log('Response:', body.slice(0, 500));
  return resp.ok;
}

async function main() {
  accountSid = await findAccountSid();

  // Test 1: Send the WORKING template with 6 variables (baseline)
  console.log('\n\n========== TEST 1: Working template + 6 vars ==========');
  const ok1 = await sendTemplate(EXISTING_SID, {
    '1': 'Product A', '2': 'Product B', '3': 'Product C',
    '4': 'Product D', '5': 'Product E', '6': 'Product F',
  });
  console.log('TEST 1:', ok1 ? 'SUCCESS' : 'FAILED');

  // Test 2: Create a 6-item dynamic template and send 6 vars
  console.log('\n\n========== TEST 2: Dynamic 6-item + 6 vars ==========');
  const sid6 = await createContent(6);
  if (sid6) {
    const ok2 = await sendTemplate(sid6, {
      '1': 'Product A', '2': 'Product B', '3': 'Product C',
      '4': 'Product D', '5': 'Product E', '6': 'Product F',
    });
    console.log('TEST 2:', ok2 ? 'SUCCESS' : 'FAILED');
  }

  // Test 3: Create a 4-item dynamic template and send 4 vars
  console.log('\n\n========== TEST 3: Dynamic 4-item + 4 vars ==========');
  const sid4 = await createContent(4);
  if (sid4) {
    const ok3 = await sendTemplate(sid4, {
      '1': 'CRENVURSTI', '2': 'PARIZER', '3': 'SUNCA DE VITA', '4': 'SUNCA JUNIOR',
    });
    console.log('TEST 3:', ok3 ? 'SUCCESS' : 'FAILED');
  }

  // Test 4: Send the WORKING template with only 4 vars (missing 5,6)
  console.log('\n\n========== TEST 4: Working template + only 4 vars ==========');
  const ok4 = await sendTemplate(EXISTING_SID, {
    '1': 'Product A', '2': 'Product B', '3': 'Product C', '4': 'Product D',
  });
  console.log('TEST 4:', ok4 ? 'SUCCESS' : 'FAILED');

  console.log('\n\n========== SUMMARY ==========');
  console.log('Test 1 (working + 6 vars):', ok1 ? 'OK' : 'FAIL');
  console.log('Test 2 (dynamic 6 + 6 vars):', sid6 ? 'ran' : 'SKIP');
  console.log('Test 3 (dynamic 4 + 4 vars):', sid4 ? 'ran' : 'SKIP');
  console.log('Test 4 (working + 4 vars):', ok4 ? 'OK' : 'FAIL');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
