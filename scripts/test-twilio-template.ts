#!/usr/bin/env tsx
/**
 * Smoke test for the **only** remaining WhatsApp template:
 * order confirmation (DA/NU buttons).
 *
 * Usage:
 *   pnpm tsx scripts/test-twilio-template.ts
 *
 * Needs:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, WHATSAPP_TEST_PHONE, TWILIO_CONFIRM_CONTENT_SID
 *
 * Optional:
 *   TEST_PRODUCT_NAME, TEST_PRICE, TEST_PICKUP_TIME
 */
import 'dotenv/config';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const FROM = process.env.TWILIO_FROM_NUMBER ?? '';
const TO = process.env.WHATSAPP_TEST_PHONE ?? '';
const CONTENT_SID = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM || !TO || !CONTENT_SID) {
  console.error(
    'Missing env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, WHATSAPP_TEST_PHONE, TWILIO_CONFIRM_CONTENT_SID'
  );
  process.exit(1);
}

function getAuth(): string {
  return Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
}

async function main() {
  const verbose = process.argv.includes('--verbose');
  const toFormatted = TO.startsWith('whatsapp:') ? TO : `whatsapp:${TO}`;
  const fromFormatted = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;

  const variables = {
    product_name: process.env.TEST_PRODUCT_NAME ?? '2x Lapte, 1x Paine',
    price: process.env.TEST_PRICE ?? '12.34',
    pickup_time: process.env.TEST_PICKUP_TIME ?? '18:30',
  };

  const params = new URLSearchParams({
    To: toFormatted,
    From: fromFormatted,
    ContentSid: CONTENT_SID,
    ContentVariables: JSON.stringify(variables),
  });

  console.log('\n=== Sending confirmation template (DA/NU) ===');
  console.log('ContentSid:', CONTENT_SID);
  if (verbose) {
    console.log('ContentVariables:', JSON.stringify(variables));
  } else {
    console.log('ContentVariables keys:', Object.keys(variables));
  }

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
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
  if (verbose) {
    console.log('Response:', body.slice(0, 500));
  }
  process.exit(resp.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
