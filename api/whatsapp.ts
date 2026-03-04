/**
 * WhatsApp AI Agent — Vercel Serverless Webhook (Twilio)
 * Spec: docs/specs/whatsapp_agent.md
 *
 * POST /api/whatsapp  → Incoming Twilio message → Claude → TwiML reply
 *
 * Env vars required:
 *   TWILIO_AUTH_TOKEN      — from Twilio Console (used for signature validation)
 *   ANTHROPIC_API_KEY      — Claude API key
 *   SUPABASE_URL           — Supabase project URL (prefer non-VITE_ for serverless)
 *   SUPABASE_ANON_KEY      — Supabase anon key (prefer non-VITE_ for serverless)
 *   (fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if non-prefixed not set)
 *
 * Optional (store info injected into agent system prompt):
 *   STORE_NAME             — e.g. "Magazinul Verde"
 *   STORE_ADDRESS          — e.g. "Str. Florilor 12, Cluj-Napoca"
 *   STORE_HOURS            — e.g. "Luni-Vineri 8-20, Sâmbătă 9-18"
 *   STORE_PHONE            — e.g. "+40 123 456 789"
 *
 * Twilio sandbox setup:
 *   1. Go to console.twilio.com → Messaging → Try it out → Send a WhatsApp message
 *   2. Set webhook URL: https://your-app.vercel.app/api/whatsapp
 *   3. Method: HTTP POST
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { validateTwilioSignature } from './lib/twilio-signature.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwilioBody {
  From?: string;        // e.g. "whatsapp:+40123456789"
  Body?: string;        // message text
  ProfileName?: string; // sender's WhatsApp display name
  To?: string;          // your Twilio number
  MessageSid?: string;
  NumMedia?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ProductRow {
  id: string;
  created_at: string;
  name: string;
  category: string | null;
  price: number | null;
  price_50: number | null;
  price_70: number | null;
  price_100: number | null;
  markup: number | null;
}

function getStorePrice(p: ProductRow): number | null {
  const tier = (p.markup as 50 | 70 | 100) || 70;
  if (tier === 50) return p.price_50 ?? p.price;
  if (tier === 100) return p.price_100 ?? p.price;
  return p.price_70 ?? p.price; // default 70%
}

interface MovementRow {
  product_id: string;
  quantity: number;
}

type ProductMatchResult =
  | { type: 'match'; product: ProductRow }
  | { type: 'not_found' }
  | { type: 'ambiguous'; candidates: string[] };

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  if (!authToken) {
    console.error('[whatsapp] Missing TWILIO_AUTH_TOKEN (required for signature validation)');
    return res.status(500).json({ error: 'Twilio not configured' });
  }

  const signatureHeader = String(req.headers['x-twilio-signature'] ?? '');
  const absoluteUrl = getAbsoluteUrl(req);
  const twilioParams = normalizeTwilioParams(req.body);
  const isValid = validateTwilioSignature({
    authToken,
    url: absoluteUrl,
    params: twilioParams,
    signature: signatureHeader,
  });

  if (!isValid) {
    console.warn('[whatsapp] Invalid or missing Twilio signature');
    return res.status(403).end();
  }

  const body = req.body as TwilioBody;
  const from = body.From ?? '';
  const text = (body.Body ?? '').trim();
  const name = body.ProfileName ?? from.replace('whatsapp:', '');

  // Ignore non-text or empty messages
  if (!from || !text) {
    return res.status(200).send(twiml(''));
  }

  // Strip "whatsapp:" prefix for DB storage, keep full form for Twilio reply
  const phone = from.replace('whatsapp:', '');

  console.log(`[whatsapp] message from ${phone} (${name}): ${text.slice(0, 60)}`);

  try {
    const reply = await buildReply(phone, name, text);
    return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(reply));
  } catch (err) {
    console.error('[whatsapp] error:', err);
    const fallback = 'Ne pare rău, a apărut o eroare. Încearcă din nou.';
    return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(fallback));
  }
}

// ─── TwiML response ───────────────────────────────────────────────────────────

function twiml(message: string): string {
  // Escape XML special chars
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${safe ? `<Message>${safe}</Message>` : ''}</Response>`;
}

// ─── AI reply builder ────────────────────────────────────────────────────────

async function buildReply(phone: string, name: string, text: string): Promise<string> {
  const sb = createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const intent = classifyIncomingText(text);
  const [history, inventoryText] = await Promise.all([
    getHistory(sb, phone),
    intent === 'store_info' ? Promise.resolve('') : getInventorySummary(sb, { intent, text }),
  ]);

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
    { role: 'user', content: text },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: buildSystemPrompt(name, phone, inventoryText),
    messages,
  });

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Persist conversation (fire-and-forget)
  saveHistory(sb, phone, [
    ...history,
    { role: 'user', content: text, timestamp: new Date().toISOString() },
    { role: 'assistant', content: replyText, timestamp: new Date().toISOString() },
  ]).catch(err => console.error('[whatsapp] saveHistory failed:', err));

  return await processOrderIntent(sb, replyText);
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(name: string, phone: string, inventoryText: string): string {
  const today = new Date().toLocaleDateString('ro-RO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const storeName    = process.env.STORE_NAME    ?? 'magazinul nostru';
  const storeAddress = process.env.STORE_ADDRESS ?? '';
  const storeHours   = process.env.STORE_HOURS   ?? '';
  const storePhone   = process.env.STORE_PHONE   ?? '';

  return `Ești asistentul WhatsApp al ${storeName}.
${storeAddress ? `Adresă: ${storeAddress}\n` : ''}${storeHours ? `Program: ${storeHours}\n` : ''}${storePhone ? `Telefon: ${storePhone}\n` : ''}

Client curent: ${name} (telefon: ${phone})
Data de azi: ${today}

${inventoryText ? `INVENTAR LIVE:\n${inventoryText}\n` : ''}

REGULI:
1. Răspunde în limba clientului (română sau engleză) — auto-detectează.
2. Fii prietenos și concis — maxim 3 propoziții per mesaj.
3. Pentru produse/stoc/preț, folosește doar datele din inventar (dacă există). Nu inventa produse sau prețuri.
4. Dacă stocul unui produs este ≤ 0, spune că nu este disponibil momentan.
5. Nu folosi markdown (fără *, _, #) — WhatsApp afișează plain text.
6. Dacă ești întrebat de adresă/program și nu sunt în mesaj, spune că nu ai informația configurată și recomandă să sune la magazin (dacă există telefon) sau să întrebe în magazin.
7. Când un client confirmă o comandă, adaugă pe ultima linie:
   ORDER:{"customer_name":"${name}","customer_phone":"${phone}","items":[{"name":"Nume produs","qty":1}],"pickup_time":"ora menționată"}`;
}

// ─── Inventory summary ───────────────────────────────────────────────────────

type IncomingIntent = 'store_info' | 'browse_inventory' | 'product_query';

function classifyIncomingText(text: string): IncomingIntent {
  const t = text.toLowerCase();
  if (/(adresă|adresa|address|unde|locați|locati|program|orar|hours|open|închis|inchis|telefon|phone|contact)/.test(t)) {
    return 'store_info';
  }
  if (/(ce av(e|ă)ți|lista|list|inventar|produse|products|available|aveți pe stoc)/.test(t)) {
    return 'browse_inventory';
  }
  return 'product_query';
}

function extractSearchTerm(text: string): string | null {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stop = new Set([
    'ai', 'aveti', 'aveți', 'are', 'ati', 'ați', 'as', 'aș', 'as', 'vrea', 'vreau', 'imi', 'îmi', 'mi', 'un', 'o',
    'la', 'in', 'în', 'pe', 'cu', 'de', 'din', 'si', 'și', 'sau', 'care', 'ce', 'cat', 'cât', 'este', 'mai', 'mult',
    'do', 'you', 'have', 'any', 'is', 'it', 'there', 'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'with', 'please',
    'price', 'cost', 'stock', 'available',
  ]);

  const candidates = cleaned.filter((w) => w.length >= 3 && !stop.has(w));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

async function getInventorySummary(
  sb: ReturnType<typeof createClient>,
  args: { intent: IncomingIntent; text: string }
): Promise<string> {
  const limit = args.intent === 'browse_inventory' ? 40 : 20;

  const term = args.intent === 'product_query' ? extractSearchTerm(args.text) : null;
  const productsQuery = sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup');

  const { data: products } = term
    ? await productsQuery.ilike('name', `%${term}%`).limit(limit)
    : await productsQuery.order('created_at', { ascending: false }).limit(limit);

  if (!products?.length) return 'Inventar indisponibil.';

  const ids = (products as ProductRow[]).map((p) => p.id);
  const { data: movements } = await sb
    .from('stock_movements')
    .select('product_id, quantity')
    .in('product_id', ids);

  const stockMap: Record<string, number> = {};
  for (const m of (movements ?? []) as MovementRow[]) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
  }

  const rows: ProductRow[] = products as ProductRow[];

  let alternatives: ProductRow[] = [];
  if (args.intent === 'product_query' && rows[0]) {
    const first = rows[0];
    const firstStock = stockMap[first.id] ?? 0;
    if (firstStock <= 0 && first.category) {
      const { data: sameCategory } = await sb
        .from('products')
        .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
        .eq('category', first.category)
        .limit(25);

      const candidateIds = (sameCategory ?? []).map((p: { id: string }) => p.id);
      const { data: altMovements } = candidateIds.length
        ? await sb
          .from('stock_movements')
          .select('product_id, quantity')
          .in('product_id', candidateIds)
        : { data: [] as unknown[] };

      const altStockMap: Record<string, number> = {};
      for (const m of (altMovements ?? []) as MovementRow[]) {
        altStockMap[m.product_id] = (altStockMap[m.product_id] ?? 0) + m.quantity;
      }

      alternatives = (sameCategory as ProductRow[] ?? [])
        .filter((p) => p.id !== first.id)
        .filter((p) => (altStockMap[p.id] ?? 0) > 0)
        .slice(0, 3);
    }
  }

  const lines = rows.map((p) => {
    const stock = stockMap[p.id] ?? 0;
    const storePrice = getStorePrice(p);
    const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
    const availability = stock > 0 ? `stoc: ${stock}` : 'indisponibil';
    const cat = p.category ? ` (${p.category})` : '';
    return `• ${p.name}${cat} — ${price}, ${availability}`;
  });

  if (alternatives.length) {
    lines.push('Alternative (în stoc):');
    for (const p of alternatives) {
      const storePrice = getStorePrice(p);
      const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
      lines.push(`• ${p.name} — ${price}`);
    }
  }

  return lines.join('\n');
}

// ─── Order intent ─────────────────────────────────────────────────────────────

async function processOrderIntent(
  sb: ReturnType<typeof createClient>,
  replyText: string
): Promise<string> {
  const match = replyText.match(/ORDER:(\{[\s\S]*?\})\s*$/);
  if (!match) return replyText;

  try {
    const orderData = JSON.parse(match[1]) as {
      customer_name: string;
      customer_phone: string;
      items: Array<{ product_id?: string; name: string; qty: number; unit_price?: number }>;
      total_price?: number;
      pickup_time?: string;
    };

    const resolved = await resolveOrderItems(sb, orderData.items);

    const { data: order } = await sb
      .from('orders')
      .insert({
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        items: resolved.items,
        total_price: resolved.totalPrice,
        pickup_time: orderData.pickup_time ?? null,
      })
      .select('order_number')
      .single();

    const orderNumber = (order as { order_number: string } | null)?.order_number ?? '—';
    return replyText.replace(/ORDER:\{[\s\S]*?\}\s*$/, `✅ Comanda ${orderNumber} înregistrată! Te așteptăm.`);
  } catch (err) {
    console.error('[whatsapp] order creation failed:', err);
    const message = err instanceof Error ? err.message : '';
    if (message.startsWith('AMBIGUOUS_ITEM:')) {
      const rawName = message.slice('AMBIGUOUS_ITEM:'.length).split('|')[0] ?? 'produs';
      return replyText.replace(
        /ORDER:\{[\s\S]*?\}\s*$/,
        `⚠️ Am găsit mai multe produse pentru „${rawName}”. Te rog trimite denumirea exactă.`
      );
    }
    if (message.startsWith('NOT_FOUND_ITEM:')) {
      const rawName = message.slice('NOT_FOUND_ITEM:'.length) || 'produsul cerut';
      return replyText.replace(
        /ORDER:\{[\s\S]*?\}\s*$/,
        `⚠️ Nu am găsit „${rawName}” în inventar. Te rog trimite denumirea exactă.`
      );
    }
    if (message.startsWith('OUT_OF_STOCK_ITEM:')) {
      const rawName = message.slice('OUT_OF_STOCK_ITEM:'.length) || 'produsul cerut';
      return replyText.replace(
        /ORDER:\{[\s\S]*?\}\s*$/,
        `⚠️ „${rawName}” nu are stoc suficient acum. Te rog ajustează cantitatea.`
      );
    }
    return replyText.replace(/ORDER:\{[\s\S]*?\}\s*$/, '⚠️ Nu am reușit să înregistrez comanda automat. Te rog încearcă din nou.');
  }
}

// ─── Conversation history ─────────────────────────────────────────────────────

async function getHistory(
  sb: ReturnType<typeof createClient>,
  phone: string
): Promise<ConversationMessage[]> {
  const { data } = await sb
    .from('conversation_history')
    .select('messages, updated_at')
    .eq('phone_number', phone)
    .maybeSingle();

  const ttlDays = Number(process.env.CONVERSATION_TTL_DAYS ?? '7');
  const effectiveTtlDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 7;

  const updatedAt = data?.updated_at ? new Date(String(data.updated_at)).getTime() : 0;
  const isExpired = updatedAt > 0 && (Date.now() - updatedAt) > effectiveTtlDays * 24 * 60 * 60 * 1000;
  if (isExpired) return [];

  return ((data?.messages ?? []) as ConversationMessage[]).slice(-20);
}

async function saveHistory(
  sb: ReturnType<typeof createClient>,
  phone: string,
  messages: ConversationMessage[]
): Promise<void> {
  await sb
    .from('conversation_history')
    .upsert(
      { phone_number: phone, messages: messages.slice(-20) },
      { onConflict: 'phone_number' }
    );
}

async function resolveOrderItems(
  sb: ReturnType<typeof createClient>,
  items: Array<{ product_id?: string; name: string; qty: number; unit_price?: number }>
): Promise<{ items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>; totalPrice: number }> {
  const resolvedItems: Array<{ product_id: string; name: string; qty: number; unit_price: number }> = [];

  for (const item of items ?? []) {
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const name = String(item.name ?? '').trim();
    if (!name) continue;

    const match = item.product_id
      ? await resolveProductById(sb, item.product_id)
      : await resolveProductByName(sb, name);

    if (match.type === 'not_found') throw new Error(`NOT_FOUND_ITEM:${name}`);
    if (match.type === 'ambiguous') throw new Error(`AMBIGUOUS_ITEM:${name}|${match.candidates.join(', ')}`);
    const p = match.product;

    const unit = getStorePrice(p);
    if (unit == null) throw new Error(`Missing price for item: ${p.name}`);

    resolvedItems.push({
      product_id: p.id,
      name: p.name,
      qty,
      unit_price: Number(unit.toFixed(2)),
    });
  }

  if (!resolvedItems.length) throw new Error('No valid items');

  const ids = resolvedItems.map((i) => i.product_id);
  const { data: movements } = await sb
    .from('stock_movements')
    .select('product_id, quantity')
    .in('product_id', ids);

  const stockMap: Record<string, number> = {};
  for (const m of (movements ?? []) as MovementRow[]) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
  }

  for (const item of resolvedItems) {
    const stock = stockMap[item.product_id] ?? 0;
    if (stock < item.qty) throw new Error(`OUT_OF_STOCK_ITEM:${item.name}`);
  }

  const totalPrice = resolvedItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  return { items: resolvedItems, totalPrice: Number(totalPrice.toFixed(2)) };
}

function normalizeTwilioParams(body: unknown): Record<string, string> {
  if (typeof body === 'string') {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  if (!body || typeof body !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export function getAbsoluteUrl(req: VercelRequest): string {
  const configured = String(process.env.TWILIO_WEBHOOK_URL ?? '').trim();
  if (configured) return configured;

  const proto = getForwardedHeader(req.headers['x-forwarded-proto']) || 'https';
  const host = getForwardedHeader(req.headers['x-forwarded-host']) || getForwardedHeader(req.headers.host);
  const url = String(req.url ?? '/api/whatsapp');

  return `${proto}://${host}${url}`;
}

function getForwardedHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').split(',')[0]?.trim() ?? '';
}

function normalizeProductText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreProductName(name: string, query: string): number {
  if (!name || !query) return 0;
  if (name === query) return 100;
  if (name.startsWith(query)) return 85;
  if (name.includes(query)) return 70;

  const queryTokens = new Set(query.split(' ').filter(Boolean));
  const nameTokens = new Set(name.split(' ').filter(Boolean));
  let overlap = 0;
  for (const t of queryTokens) {
    if (nameTokens.has(t)) overlap += 1;
  }
  return overlap > 0 ? 40 + overlap * 10 : 0;
}

async function resolveProductById(
  sb: ReturnType<typeof createClient>,
  id: string
): Promise<ProductMatchResult> {
  const { data: product } = await sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
    .eq('id', id)
    .maybeSingle();

  return product ? { type: 'match', product: product as ProductRow } : { type: 'not_found' };
}

async function resolveProductByName(
  sb: ReturnType<typeof createClient>,
  rawName: string
): Promise<ProductMatchResult> {
  const query = normalizeProductText(rawName);
  if (!query) return { type: 'not_found' };

  const { data: exactRows } = await sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
    .ilike('name', rawName.trim())
    .limit(3);

  const exact = (exactRows as ProductRow[] | null) ?? [];
  if (exact.length === 1) return { type: 'match', product: exact[0] };
  if (exact.length > 1) return { type: 'ambiguous', candidates: exact.slice(0, 3).map((p) => p.name) };

  const { data: fuzzyRows } = await sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
    .ilike('name', `%${rawName.trim()}%`)
    .limit(12);

  const candidates = (fuzzyRows as ProductRow[] | null) ?? [];
  if (!candidates.length) return { type: 'not_found' };

  const ranked = candidates
    .map((p) => ({
      product: p,
      score: scoreProductName(normalizeProductText(p.name), query),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'ro'));

  if (!ranked.length || ranked[0].score < 50) return { type: 'not_found' };
  if (ranked.length > 1 && ranked[0].score - ranked[1].score <= 5) {
    return { type: 'ambiguous', candidates: ranked.slice(0, 3).map((x) => x.product.name) };
  }

  return { type: 'match', product: ranked[0].product };
}
