#!/usr/bin/env tsx
/**
 * Full-flow test: validates ALL template types work end-to-end.
 *
 * Modes:
 *   --dry-run   Create Content resources + validate structure (no messages sent, no quota used)
 *   (default)   Send real messages via Twilio Messages API
 *
 * Usage:
 *   pnpm tsx scripts/test-twilio-full-flow.ts --dry-run   # safe, no msg quota
 *   pnpm tsx scripts/test-twilio-full-flow.ts              # live send (50/day sandbox limit)
 */
import 'dotenv/config';
import { getListPickerContentSid, clearContentSidCache } from '../lib/whatsapp/content-templates.js';

const DRY_RUN = process.argv.includes('--dry-run');

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const FROM = process.env.TWILIO_FROM_NUMBER ?? '';
const TO = process.env.WHATSAPP_TEST_PHONE ?? '';

const WELCOME_SID = process.env.TWILIO_WELCOME_SID ?? '';
const PRODUCT_LIST_SID = process.env.TWILIO_PRODUCT_LIST_SID ?? '';
const QTY_SID = process.env.TWILIO_QTY_SID ?? '';
const CONFIRM_SID = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.error('Missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN');
  process.exit(1);
}

if (!DRY_RUN && (!FROM || !TO)) {
  console.error('Missing: TWILIO_FROM_NUMBER, WHATSAPP_TEST_PHONE (required for live mode)');
  process.exit(1);
}

const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

/** WhatsApp list-picker item titles are limited to 24 characters */
const MAX_LIST_ITEM_TITLE_LEN = 24;

// ─── Content API helpers ────────────────────────────────────────────────────

interface ContentResource {
  sid: string;
  friendly_name: string;
  types: Record<string, unknown>;
  variables: Record<string, unknown>;
}

async function fetchContent(contentSid: string): Promise<ContentResource> {
  const resp = await fetch(`https://content.twilio.com/v1/Content/${contentSid}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Fetch Content ${contentSid} failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as ContentResource;
}

/** Extract variable placeholder names from a Content resource */
function extractPlaceholders(content: ContentResource): string[] {
  const json = JSON.stringify(content.types);
  const matches = json.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

// ─── Validation (dry-run) ───────────────────────────────────────────────────

async function validateTemplate(
  contentSid: string,
  variables?: Record<string, string>,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const content = await fetchContent(contentSid);
  console.log(`  Content SID: ${content.sid} (${content.friendly_name})`);

  const placeholders = extractPlaceholders(content);
  console.log(`  Placeholders in template: [${placeholders.join(', ')}]`);
  console.log(`  Variables provided: ${variables ? JSON.stringify(variables) : '(none)'}`);

  // Check: all placeholders have a corresponding variable
  if (placeholders.length > 0 && !variables) {
    errors.push(`Template has ${placeholders.length} placeholder(s) but no variables provided`);
  } else if (variables) {
    for (const ph of placeholders) {
      if (!(ph in variables)) {
        errors.push(`Missing variable for placeholder {{${ph}}}`);
      }
    }
    // Check: no extra variables beyond what template expects
    for (const key of Object.keys(variables)) {
      if (!placeholders.includes(key)) {
        errors.push(`Extra variable "${key}" not in template placeholders`);
      }
    }
  }

  // Check: list-picker item titles ≤ 24 chars
  const types = content.types as Record<string, Record<string, unknown>>;
  const listPicker = types['twilio/list-picker'] as { items?: Array<{ item: string }> } | undefined;
  if (listPicker?.items && variables) {
    for (const item of listPicker.items) {
      const match = item.item.match(/\{\{(\w+)\}\}/);
      if (match) {
        const varName = match[1];
        const value = variables[varName];
        if (value && value.length > MAX_LIST_ITEM_TITLE_LEN) {
          errors.push(`Variable "${varName}" value "${value}" is ${value.length} chars (max ${MAX_LIST_ITEM_TITLE_LEN})`);
        }
      }
    }
  }

  // Check: no empty variable values
  if (variables) {
    for (const [key, val] of Object.entries(variables)) {
      if (!val || val.trim() === '') {
        errors.push(`Variable "${key}" is empty`);
      }
    }
  }

  if (errors.length > 0) {
    console.log(`  VALIDATION ERRORS:`);
    for (const e of errors) console.log(`    - ${e}`);
  } else {
    console.log(`  Validation: OK`);
  }

  return { ok: errors.length === 0, errors };
}

// ─── Live send ──────────────────────────────────────────────────────────────

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

// ─── Test harness ───────────────────────────────────────────────────────────

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

function isRateLimit(body: string): boolean {
  return body.includes('"code":63038') || body.includes('daily messages limit');
}

/** Run validation (dry-run) or live send, and assert success */
async function assertTemplateWorks(
  contentSid: string,
  variables?: Record<string, string>,
): Promise<void> {
  if (DRY_RUN) {
    const v = await validateTemplate(contentSid, variables);
    assert(v.ok, `Validation failed: ${v.errors.join('; ')}`);
  } else {
    const r = await sendTemplate(contentSid, variables);
    console.log(`  Status: ${r.status}`);
    assert(r.ok || isRateLimit(r.body), `Send failed: ${r.body}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN (validate only, no messages sent)' : 'LIVE (sending real messages)'}\n`);
  clearContentSidCache();

  // ── Test 1: Welcome template ──────────────────────────────────────
  await test('Welcome template (no variables)', async () => {
    assert(!!WELCOME_SID, 'TWILIO_WELCOME_SID not set');
    await assertTemplateWorks(WELCOME_SID);
  });

  // ── Test 2: Category list-picker (6 items, static SID) ───────────
  await test('Category list-picker — 6 items (static SID)', async () => {
    assert(!!PRODUCT_LIST_SID, 'TWILIO_PRODUCT_LIST_SID not set');
    const categories = ['Beverages', 'Cereale', 'Dairy', 'General', 'Meat', 'Produce'];
    const vars: Record<string, string> = {};
    for (let i = 0; i < 6; i++) vars[String(i + 1)] = categories[i];
    await assertTemplateWorks(PRODUCT_LIST_SID, vars);
  });

  // ── Test 3: Product list-picker (4 items, dynamic Content) ───────
  await test('Product list-picker — 4 items (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(4);
    assert(!!sid, 'Failed to create 4-item Content resource');
    const raw = [
      'CRENVURSTI URSULET FILLETTI',
      'PARIZER DOCTORSKAIA CARMEZ',
      'SUNCA DE VITA ROGOB',
      'SUNCA JUNIOR ROGOB',
    ];
    const vars: Record<string, string> = {};
    for (let i = 0; i < raw.length; i++) {
      vars[String(i + 1)] = raw[i].length > MAX_LIST_ITEM_TITLE_LEN
        ? raw[i].slice(0, MAX_LIST_ITEM_TITLE_LEN - 1) + '…'
        : raw[i];
    }
    console.log(`  Variables: ${JSON.stringify(vars)}`);
    await assertTemplateWorks(sid!, vars);
  });

  // ── Test 4: Product list-picker (2 items, dynamic Content) ───────
  await test('Product list-picker — 2 items (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(2);
    assert(!!sid, 'Failed to create 2-item Content resource');
    const vars: Record<string, string> = {
      '1': 'LAPTE PROASPAT 3.5%',
      '2': 'SMANTANA 20% ZUZU',
    };
    await assertTemplateWorks(sid!, vars);
  });

  // ── Test 5: Product list-picker (1 item, dynamic Content) ────────
  await test('Product list-picker — 1 item (dynamic Content)', async () => {
    const sid = await getListPickerContentSid(1);
    assert(!!sid, 'Failed to create 1-item Content resource');
    await assertTemplateWorks(sid!, { '1': 'PAINE ALBA FELII' });
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
    await assertTemplateWorks(QTY_SID, { product_name: 'CRENVURSTI URSULET FILLETTI' });
  });

  // ── Test 8: Confirm template ─────────────────────────────────────
  await test('Confirm template (product_name, price, pickup_time)', async () => {
    assert(!!CONFIRM_SID, 'TWILIO_CONFIRM_CONTENT_SID not set');
    await assertTemplateWorks(CONFIRM_SID, {
      product_name: 'CRENVURSTI URSULET',
      price: '5.99',
      pickup_time: '14:00',
    });
  });

  // ── Test 9: Truncation edge cases ────────────────────────────────
  if (DRY_RUN) {
    await test('Truncation — 24-char boundary values', async () => {
      const sid = await getListPickerContentSid(3);
      assert(!!sid, 'Failed to create 3-item Content resource');
      const vars: Record<string, string> = {
        '1': 'EXACTLY TWENTY FOUR CHR',  // 23 chars — under limit
        '2': 'EXACTLY TWENTY FOUR CHAR',  // 24 chars — at limit
        '3': 'A'.repeat(23) + '…',  // 24 chars — truncated format
      };
      for (const [k, v] of Object.entries(vars)) {
        console.log(`  var[${k}] = "${v}" (${v.length} chars)`);
      }
      await assertTemplateWorks(sid!, vars);
    });

    await test('Over-limit value caught by validation', async () => {
      const sid = await getListPickerContentSid(2);
      assert(!!sid, 'Failed to create 2-item Content resource');
      const v = await validateTemplate(sid!, {
        '1': 'SHORT',
        '2': 'THIS IS WAY TOO LONG FOR A LIST ITEM TITLE',  // 43 chars
      });
      assert(!v.ok, 'Should have failed validation for >24 char value');
      assert(
        v.errors.some(e => e.includes('max 24')),
        `Expected max-length error, got: ${v.errors.join('; ')}`,
      );
      console.log(`  Correctly caught: ${v.errors[0]}`);
    });
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY (${DRY_RUN ? 'dry-run' : 'live'})`);
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
