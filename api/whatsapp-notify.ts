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
 *   VITE_NOTIFY_SECRET  — shared secret checked against x-notify-secret header
 *   SUPABASE_URL        — Supabase project URL (prefer non-VITE_ for serverless)
 *   SUPABASE_ANON_KEY   — Supabase anon key (prefer non-VITE_ for serverless)
 *   (fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if non-prefixed not set)
 *
 * Optional:
 *   STORE_NAME          — used in message text
 *   STORE_PHONE         — included in cancellation message
 *
 * Note: notification messages are sent in both Romanian and English since
 * the customer's preferred language is not stored server-side.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth: verify shared secret sent by the React client
  const secret = req.headers['x-notify-secret'];
  const expectedSecret = process.env.VITE_NOTIFY_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    console.warn('[whatsapp-notify] Unauthorized request — bad or missing x-notify-secret');
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

  const sb = createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
  );

  // Fetch order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error } = await (sb as any)
    .from('orders')
    .select('order_number, customer_phone, total_price, pickup_time')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('[whatsapp-notify] Order not found', { orderId, error });
    return res.status(404).json({ error: 'Order not found' });
  }

  const o = order as OrderRow;
  const storeName  = process.env.STORE_NAME  ?? 'magazinul nostru';
  const storePhone = process.env.STORE_PHONE ?? '';

  const message = action === 'confirm'
    ? buildConfirmMessage(o, storeName)
    : buildCancelMessage(o, storeName, storePhone);

  try {
    // Normalize numbers: env var stores digits only, Twilio needs "whatsapp:+..." format
    const fromWa = `whatsapp:+${fromNumber.replace(/^\+/, '')}`;
    const toWa   = `whatsapp:${o.customer_phone.startsWith('+') ? '' : '+'}${o.customer_phone}`;

    await sendWhatsApp(accountSid, authToken, fromWa, toWa, message);
    console.log(`[whatsapp-notify] Sent ${action} notification for ${o.order_number}`);
    return res.status(200).json({ ok: true, order_number: o.order_number });
  } catch (err) {
    console.error('[whatsapp-notify] Twilio send failed:', err);
    return res.status(502).json({ error: 'Failed to send WhatsApp message' });
  }
}

// ─── Message templates ────────────────────────────────────────────────────────
// Bilingual (RO + EN) because customer language preference is not stored server-side.

function buildConfirmMessage(order: OrderRow, storeName: string): string {
  const pickup = order.pickup_time ? ` Te asteptam la ora ${order.pickup_time}.` : '';
  const pickupEn = order.pickup_time ? ` We'll have your order ready at ${order.pickup_time}.` : '';
  return (
    `Comanda ${order.order_number} a fost confirmata de ${storeName}!${pickup} Total: EUR${order.total_price.toFixed(2)}. Plata se face la magazin.\n` +
    `Order ${order.order_number} confirmed by ${storeName}!${pickupEn} Total: EUR${order.total_price.toFixed(2)}. Payment at store.`
  );
}

function buildCancelMessage(order: OrderRow, storeName: string, storePhone: string): string {
  const contact = storePhone ? ` Contacteaza-ne la ${storePhone} pentru detalii.` : '';
  const contactEn = storePhone ? ` Contact us at ${storePhone} for details.` : '';
  return (
    `Ne pare rau, comanda ${order.order_number} de la ${storeName} nu poate fi procesata.${contact}\n` +
    `Sorry, order ${order.order_number} from ${storeName} cannot be processed.${contactEn}`
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
