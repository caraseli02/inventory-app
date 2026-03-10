/**
 * WhatsApp order notification — Vercel Serverless
 *
 * POST /api/whatsapp-notify
 * Body: { orderId: string, action: 'confirm' | 'cancel' }
 *
 * Called by the owner's OrdersPage after confirming or cancelling an order.
 * Sends a WhatsApp message to the customer via Twilio REST API.
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID  — from Twilio Console (Account Info)
 *   TWILIO_AUTH_TOKEN   — from Twilio Console
 *   TWILIO_FROM_NUMBER  — with or without leading +, no "whatsapp:" prefix, e.g. "+14155238886"
 *   SUPABASE_URL        — Supabase project URL (prefer non-VITE_ for serverless)
 *   SUPABASE_ANON_KEY   — Supabase anon key (prefer non-VITE_ for serverless)
 *   (fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if non-prefixed not set)
 *
 * Optional:
 *   STORE_NAME          — used in message text
 *   STORE_PHONE         — included in cancellation message
 *
 * Language detection: reads the last customer message from conversation_history.
 * Cyrillic chars → Russian (RU), otherwise defaults to Spanish (ES).
 * All messages are sent as bilingual: Romanian + detected second language.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface NotifyBody {
  orderId?: string;
  action?: 'confirm' | 'cancel';
}

interface OrderRow {
  order_number: string;
  customer_phone: string;
  total_price: number;
  pickup_time: string | null;
}

type SecondLang = 'es' | 'ru';

function createServerSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth: require a Supabase access token (no client-shipped shared secret)
  const authHeader = String(req.headers.authorization ?? '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() ?? '';
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orderId, action } = req.body as NotifyBody;
  if (!orderId || !action) {
    return res.status(400).json({ error: 'orderId and action are required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken  = process.env.TWILIO_AUTH_TOKEN  ?? '';
  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? '';

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[whatsapp-notify] Missing Twilio env vars');
    return res.status(500).json({ error: 'Twilio not configured' });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[whatsapp-notify] Missing Supabase env vars');
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const sb = createServerSupabaseClient(supabaseUrl, supabaseAnonKey);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.auth as any).getUser(accessToken);
    if (error || !data.user) {
      console.warn('[whatsapp-notify] Unauthorized request — invalid Supabase token');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    console.warn('[whatsapp-notify] Unauthorized request — token validation failed', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  // Fetch order
  const { data: order, error } = await db
    .from('orders')
    .select('order_number, customer_phone, total_price, pickup_time')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('[whatsapp-notify] Order not found', { orderId, error });
    return res.status(404).json({ error: 'Order not found' });
  }

  const o = order as OrderRow;

  // Detect customer language from their last message in conversation_history
  const secondLang = await detectSecondLang(db, o.customer_phone);

  const storeName  = process.env.STORE_NAME  ?? 'magazinul nostru';
  const storePhone = process.env.STORE_PHONE ?? '';

  const message = action === 'confirm'
    ? buildConfirmMessage(o, storeName, secondLang)
    : buildCancelMessage(o, storeName, storePhone, secondLang);

  try {
    // Normalize numbers: env var stores digits only, Twilio needs "whatsapp:+..." format
    const fromWa = `whatsapp:+${fromNumber.replace(/^\+/, '')}`;
    const toWa   = `whatsapp:${o.customer_phone.startsWith('+') ? '' : '+'}${o.customer_phone}`;

    await sendWhatsApp(accountSid, authToken, fromWa, toWa, message);
    console.log(`[whatsapp-notify] Sent ${action} notification for ${o.order_number} (lang: ro+${secondLang})`);
    return res.status(200).json({ ok: true, order_number: o.order_number });
  } catch (err) {
    console.error('[whatsapp-notify] Twilio send failed:', err);
    return res.status(502).json({ error: 'Failed to send WhatsApp message' });
  }
}

// ─── Language detection ───────────────────────────────────────────────────────

/** Checks last customer message in conversation_history for Cyrillic chars.
 *  Returns 'ru' if found, 'es' otherwise (default second language). */
async function detectSecondLang(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  phone: string
): Promise<SecondLang> {
  const { data } = await db
    .from('conversation_history')
    .select('messages')
    .eq('phone_number', phone)
    .maybeSingle();

  if (!data?.messages) return 'es';

  const msgs = data.messages as Array<{ role: string; content: string }>;
  const lastUserMsg = msgs.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
  return /[\u0400-\u04FF]/.test(lastUserMsg) ? 'ru' : 'es';
}

// ─── Message templates ────────────────────────────────────────────────────────
// Bilingual: Romanian + Spanish (default) or Romanian + Russian (detected).

function buildConfirmMessage(order: OrderRow, storeName: string, lang: SecondLang): string {
  const pickup = order.pickup_time ? ` Te asteptam la ora ${order.pickup_time}.` : '';
  const total = order.total_price.toFixed(2);

  const second = lang === 'ru'
    ? `Заказ ${order.order_number} подтверждён магазином ${storeName}!${order.pickup_time ? ` Ждём вас в ${order.pickup_time}.` : ''} Итого: EUR${total}. Оплата в магазине.`
    : `Pedido ${order.order_number} confirmado por ${storeName}!${order.pickup_time ? ` Le esperamos a las ${order.pickup_time}.` : ''} Total: EUR${total}. Pago en tienda.`;

  return (
    `Comanda ${order.order_number} a fost confirmata de ${storeName}!${pickup} Total: EUR${total}. Plata se face la magazin.\n` +
    second
  );
}

function buildCancelMessage(order: OrderRow, storeName: string, storePhone: string, lang: SecondLang): string {
  const contact = storePhone ? ` Contacteaza-ne la ${storePhone} pentru detalii.` : '';

  const second = lang === 'ru'
    ? `К сожалению, заказ ${order.order_number} от ${storeName} не может быть обработан.${storePhone ? ` Свяжитесь с нами по номеру ${storePhone}.` : ''}`
    : `Lo sentimos, el pedido ${order.order_number} de ${storeName} no puede procesarse.${storePhone ? ` Contáctenos al ${storePhone}.` : ''}`;

  return (
    `Ne pare rau, comanda ${order.order_number} de la ${storeName} nu poate fi procesata.${contact}\n` +
    second
  );
}

// ─── Twilio REST helper ───────────────────────────────────────────────────────

async function sendWhatsApp(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio ${response.status}: ${text}`);
  }
}
