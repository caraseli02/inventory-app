/**
 * WhatsApp AI Agent — Vercel Serverless Webhook
 * Spec: docs/specs/whatsapp_agent.md
 *
 * GET  /api/whatsapp  → Meta webhook verification handshake
 * POST /api/whatsapp  → Incoming message → Claude → reply
 *
 * Env vars required:
 *   META_WEBHOOK_VERIFY_TOKEN  — any string, set in Meta Developer Console
 *   META_PHONE_NUMBER_ID       — from Meta Developer Console
 *   META_WHATSAPP_TOKEN        — permanent access token from Meta
 *   ANTHROPIC_API_KEY          — Claude API key
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — Supabase anon/publishable key
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
        }>;
        contacts?: Array<{
          profile?: { name?: string };
        }>;
      };
    }>;
  }>;
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
}

interface MovementRow {
  product_id: string;
  quantity: number;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  if (req.method === 'POST') {
    // Always ACK immediately — Meta retries if it doesn't get 200 fast
    res.status(200).json({ ok: true });
    await handleIncoming(req).catch(err =>
      console.error('[whatsapp] unhandled error:', err)
    );
    return;
  }

  return res.status(405).end();
}

// ─── Verification ─────────────────────────────────────────────────────────────

function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[whatsapp] webhook verified');
    return res.status(200).send(challenge);
  }

  console.warn('[whatsapp] verification failed — token mismatch');
  return res.status(403).end();
}

// ─── Incoming message ────────────────────────────────────────────────────────

async function handleIncoming(req: VercelRequest) {
  const body = req.body as MetaWebhookBody;
  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message || message.type !== 'text' || !message.text?.body) return;

  const phone = message.from;
  const text = message.text.body.trim();
  const name = value?.contacts?.[0]?.profile?.name ?? phone;

  console.log(`[whatsapp] message from ${phone} (${name}): ${text.slice(0, 60)}`);

  const reply = await buildReply(phone, name, text);
  await sendMessage(phone, reply);
}

// ─── AI reply builder ────────────────────────────────────────────────────────

async function buildReply(phone: string, name: string, text: string): Promise<string> {
  const sb = createClient(
    process.env.VITE_SUPABASE_URL ?? '',
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Load conversation history + inventory in parallel
  const [history, inventoryText] = await Promise.all([
    getHistory(sb, phone),
    getInventorySummary(sb),
  ]);

  const systemPrompt = buildSystemPrompt(name, phone, inventoryText);

  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
    { role: 'user', content: text },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });

  const replyText =
    response.content[0].type === 'text' ? response.content[0].text : '';

  // Persist conversation (fire-and-forget)
  saveHistory(sb, phone, [
    ...history,
    { role: 'user', content: text, timestamp: new Date().toISOString() },
    { role: 'assistant', content: replyText, timestamp: new Date().toISOString() },
  ]).catch(err => console.error('[whatsapp] saveHistory failed:', err));

  // If Claude embedded an ORDER, create it and replace the JSON with order number
  return await processOrderIntent(sb, replyText);
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(name: string, phone: string, inventoryText: string): string {
  const today = new Date().toLocaleDateString('ro-RO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `Ești asistentul WhatsApp al unui magazin alimentar local. Clienții îți scriu pentru a verifica stocul, prețurile sau pentru a plasa o comandă de ridicare.

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

async function getInventorySummary(
  sb: ReturnType<typeof createClient>
): Promise<string> {
  const [{ data: products }, { data: movements }] = await Promise.all([
    sb.from('products').select('id, name, price').limit(200),
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
      const price = p.price != null ? `€${p.price.toFixed(2)}` : 'preț nedefinit';
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
    const confirmation = `✅ Comanda ${orderNumber} înregistrată! Te așteptăm.`;

    return replyText.replace(/ORDER:\{[\s\S]*?\}\s*$/, confirmation);
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

  const messages = (data?.messages ?? []) as ConversationMessage[];
  return messages.slice(-20); // last 10 exchanges
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

// ─── Meta API ─────────────────────────────────────────────────────────────────

async function sendMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID ?? '';
  const token = process.env.META_WHATSAPP_TOKEN ?? '';

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] sendMessage failed:', err);
  }
}
