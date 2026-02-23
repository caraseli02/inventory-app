/**
 * WhatsApp AI Agent — Vercel Serverless Webhook (Twilio)
 * Spec: docs/specs/whatsapp_agent.md
 *
 * POST /api/whatsapp  → Incoming Twilio message → Claude → TwiML reply
 *
 * Env vars required:
 *   TWILIO_AUTH_TOKEN      — from Twilio Console (used for signature validation)
 *   ANTHROPIC_API_KEY      — Claude API key
 *   VITE_SUPABASE_URL      — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY — Supabase anon/publishable key
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
  name: string;
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
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
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [history, inventoryText] = await Promise.all([
    getHistory(sb, phone),
    getInventorySummary(sb),
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
  const storeAddress = process.env.STORE_ADDRESS ?? '(adresă neconfigurată)';
  const storeHours   = process.env.STORE_HOURS   ?? '(program neconfigurat)';
  const storePhone   = process.env.STORE_PHONE   ?? '';

  return `Ești asistentul WhatsApp al ${storeName}.
Adresă: ${storeAddress}
Program: ${storeHours}${storePhone ? `\nTelefon: ${storePhone}` : ''}

Client curent: ${name} (telefon: ${phone})
Data de azi: ${today}

INVENTAR LIVE:
${inventoryText}

REGULI:
1. Răspunde în limba clientului (română sau engleză) — auto-detectează.
2. Fii prietenos și concis — maxim 3 propoziții per mesaj.
3. Folosește doar datele din inventarul de mai sus. Nu inventa produse sau prețuri.
4. Dacă stocul unui produs este ≤ 0, spune că nu este disponibil momentan.
5. Nu folosi markdown (fără *, _, #) — WhatsApp afișează plain text.
6. Când un client confirmă o comandă, adaugă pe ultima linie:
   ORDER:{"customer_name":"${name}","customer_phone":"${phone}","items":[{"product_id":"ID_PRODUS","name":"Nume produs","qty":1,"unit_price":0.00}],"total_price":0.00,"pickup_time":"ora menționată"}`;
}

// ─── Inventory summary ───────────────────────────────────────────────────────

async function getInventorySummary(sb: ReturnType<typeof createClient>): Promise<string> {
  const [{ data: products }, { data: movements }] = await Promise.all([
    sb.from('products').select('id, name, price, price_50, price_70, price_100, markup').limit(200),
    sb.from('stock_movements').select('product_id, quantity'),
  ]);

  if (!products?.length) return 'Inventar indisponibil.';

  const stockMap: Record<string, number> = {};
  for (const m of (movements ?? []) as MovementRow[]) {
    stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
  }

  return (products as ProductRow[])
    .map(p => {
      const stock = stockMap[p.id] ?? 0;
      const storePrice = getStorePrice(p);
      const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
      const availability = stock > 0 ? `stoc: ${stock}` : 'indisponibil';
      return `• ${p.name} — ${price}, ${availability} [id:${p.id}]`;
    })
    .join('\n');
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
      items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>;
      total_price: number;
      pickup_time?: string;
    };

    const { data: order } = await sb
      .from('orders')
      .insert({
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        items: orderData.items,
        total_price: orderData.total_price,
        pickup_time: orderData.pickup_time ?? null,
      })
      .select('order_number')
      .single();

    const orderNumber = (order as { order_number: string } | null)?.order_number ?? '—';
    return replyText.replace(/ORDER:\{[\s\S]*?\}\s*$/, `✅ Comanda ${orderNumber} înregistrată! Te așteptăm.`);
  } catch (err) {
    console.error('[whatsapp] order creation failed:', err);
    return replyText.replace(/ORDER:\{[\s\S]*?\}\s*$/, '');
  }
}

// ─── Conversation history ─────────────────────────────────────────────────────

async function getHistory(
  sb: ReturnType<typeof createClient>,
  phone: string
): Promise<ConversationMessage[]> {
  const { data } = await sb
    .from('conversation_history')
    .select('messages')
    .eq('phone_number', phone)
    .maybeSingle();

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
      { phone_number: phone, messages: messages.slice(-40) },
      { onConflict: 'phone_number' }
    );
}
