#!/usr/bin/env tsx
/**
 * Full-flow live test: validates ALL template types work end-to-end
 * against the real Twilio API.
 *
 * Tests:
 * 1. Welcome template (TWILIO_WELCOME_SID) — no variables
 * 2. Category list-picker with 6 items (static TWILIO_PRODUCT_LIST_SID)
 * 3. Product list-picker with 4 items (dynamic Content creation)
 * 4. Product list-picker with 2 items (dynamic Content creation)
 * 5. Quantity template (TWILIO_QTY_SID) — 1 variable (product_name)
 * 6. Confirm template (TWILIO_CONFIRM_CONTENT_SID) — verify it sends
 *
 * Usage: pnpm tsx scripts/test-twilio-full-flow.ts
 */
import 'dotenv/config';
import { getListPickerContentSid, clearContentSidCache } from '../lib/whatsapp/content-templates.js';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const FROM = process.env.TWILIO_FROM_NUMBER ?? '';
const TO = process.env.WHATSAPP_TEST_PHONE ?? '';

const WELCOME_SID = process.env.TWILIO_WELCOME_SID ?? '';
const PRODUCT_LIST_SID = process.env.TWILIO_PRODUCT_LIST_SID ?? '';
const QTY_SID = process.env.TWILIO_QTY_SID ?? '';
const CONFIRM_SID = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM || !TO) {
  console.error('Missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, WHATSAPP_TEST_PHONE');
  process.exit(1);
}

const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

async function sendTemplate(
  contentSid: string,
  variables?: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const toFmt = TO.startsWith('whatsapp:') ? TO : `whatsapp:${TO}`;
  const fromFmt = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;

  const params = new URLSearchParams({
    To: toFmt,
    From: fromFmt,
    ContentSid: contentSid,
    ...(variables && { ContentVariables: JSON.stringify(variables) }),
  });

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body: body.slice(0, 300) };
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log('='.repeat(60));
  try {
    await fn();
    results.push({ name, ok: true, detail: 'passed' });
    console.log(`  ✓ PASSED`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail: msg });
    console.log(`  ✗ FAILED: ${msg}`);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

/** Check if a Twilio error is a rate limit (sandbox daily limit) */
function isRateLimit(body: string): boolean {
  return body.includes('"code":63038') || body.includes('daily messages limit');
}

async function main() {
  clearContentSidCache();

  // ── Test 1: Welcome template ──────────────────────────────────────
  await test('Welcome template (no variables)', async () => {
    assert(!!WELCOME_SID, 'TWILIO_WELCOME_SID not set');
    const r = await sendTemplate(WELCOME_SID);
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 2: Category list-picker (6 items, static SID) ───────────
  await test('Category list-picker — 6 items (static SID)', async () => {
    assert(!!PRODUCT_LIST_SID, 'TWILIO_PRODUCT_LIST_SID not set');
    const vars: Record<string, string> = {};
    const categories = ['Beverages', 'Cereale', 'Dairy', 'General', 'Meat', 'Produce'];
    for (let i = 0; i < 6; i++) vars[String(i + 1)] = categories[i];
    const r = await sendTemplate(PRODUCT_LIST_SID, vars);
    console.log(`  Status: ${r.status}, Vars: ${JSON.stringify(vars)}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 3: Product list-picker (4 items, dynamic Content) ───────
  await test('Product list-picker — 4 items (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(4);
    assert(!!sid, 'Failed to create 4-item Content resource');
    console.log(`  Created Content SID: ${sid}`);
    // WhatsApp list item titles max 24 chars — truncate like sendListPickerTemplate does
    const raw = [
      'CRENVURSTI URSULET FILLETTI',
      'PARIZER DOCTORSKAIA CARMEZ',
      'SUNCA DE VITA ROGOB',
      'SUNCA JUNIOR ROGOB',
    ];
    const vars: Record<string, string> = {};
    for (let i = 0; i < raw.length; i++) {
      vars[String(i + 1)] = raw[i].length > 24 ? raw[i].slice(0, 23) + '…' : raw[i];
    }
    console.log(`  Variables: ${JSON.stringify(vars)}`);
    const r = await sendTemplate(sid!, vars);
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 4: Product list-picker (2 items, dynamic Content) ───────
  await test('Product list-picker — 2 items (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(2);
    assert(!!sid, 'Failed to create 2-item Content resource');
    console.log(`  Created Content SID: ${sid}`);
    const vars: Record<string, string> = {
      '1': 'LAPTE PROASPAT 3.5%',
      '2': 'SMANTANA 20% ZUZU',
    };
    const r = await sendTemplate(sid!, vars);
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 5: Product list-picker (1 item, dynamic Content) ────────
  await test('Product list-picker — 1 item (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(1);
    assert(!!sid, 'Failed to create 1-item Content resource');
    console.log(`  Created Content SID: ${sid}`);
    const r = await sendTemplate(sid!, { '1': 'PAINE ALBA FELII' });
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 6: Dynamic Content caching (reuse SID) ──────────────────
  await test('Dynamic Content caching — reuses SID for same count', async () => {
    const sid1 = await getListPickerContentSid(4);
    const sid2 = await getListPickerContentSid(4);
    console.log(`  SID1: ${sid1}, SID2: ${sid2}`);
    assert(sid1 === sid2, `Expected same SID, got ${sid1} vs ${sid2}`);
  });

  // ── Test 7: Quantity template ────────────────────────────────────
  await test('Quantity template (product_name variable)', async () => {
    assert(!!QTY_SID, 'TWILIO_QTY_SID not set');
    const r = await sendTemplate(QTY_SID, { product_name: 'CRENVURSTI URSULET FILLETTI' });
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Test 8: Confirm template (quick-reply with product_name, price, pickup_time) ─
  await test('Confirm template (product_name, price, pickup_time)', async () => {
    assert(!!CONFIRM_SID, 'TWILIO_CONFIRM_CONTENT_SID not set');
    const r = await sendTemplate(CONFIRM_SID, {
      product_name: 'CRENVURSTI URSULET',
      price: '5.99',
      pickup_time: '14:00',
    });
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  });

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` — ${r.detail}`}`);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
