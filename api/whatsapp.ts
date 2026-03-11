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
import { waitUntil } from '@vercel/functions';
import { validateTwilioSignature } from './lib/twilio-signature.js';
import { getTwilioAuthToken } from '../lib/whatsapp/config.js';
import { createSupabaseClient } from '../lib/whatsapp/db.js';
import { twiml, sendRestMessage, sendTemplateMessage, sendTypingIndicator } from '../lib/whatsapp/transport.js';
import {
  getPendingOrder,
  hasConversationHistory,
  storePendingOrder,
} from '../lib/whatsapp/conversation-state.js';
import { getAbsoluteUrl } from '../lib/whatsapp/url.js';
import { detectEnglish } from '../lib/whatsapp/conversation.js';
import { createPendingOrderFromPending } from '../lib/whatsapp/order-intent.js';
import { buildReplyWithPending } from '../lib/whatsapp/llm.js';
import type { TwilioBody } from '../lib/whatsapp/types.js';

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const authToken = getTwilioAuthToken();
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
  const buttonPayload = body.ButtonPayload ?? '';
  const name = body.ProfileName ?? from.replace('whatsapp:', '');

  // Strip "whatsapp:" prefix for DB storage, keep full form for Twilio reply
  const phone = from.replace('whatsapp:', '');

  // Handle button tap (order confirmation/cancellation) — ButtonPayload takes priority over text
  if (buttonPayload) {
    console.log(`[whatsapp] button from ${phone}: ${buttonPayload}`);
    // Respond instantly with empty TwiML, send real response via REST
    res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
    const sb = createSupabaseClient();
    waitUntil(
      (async () => {
        if (buttonPayload === 'confirm') {
          const pending = await getPendingOrder(sb, phone);
          if (!pending) {
            await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
            return;
          }
          const orderNumber = await createPendingOrderFromPending(sb, pending);
          await sendRestMessage(from, `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`);
        } else if (buttonPayload === 'cancel') {
          await getPendingOrder(sb, phone); // reads + nulls pending_order
          await sendRestMessage(from, '❌ Comanda a fost anulată.');
        }
      })().catch(async (err) => {
        console.error('[whatsapp] button handling failed:', err);
        await sendRestMessage(from, 'Ne pare rău, a apărut o eroare.');
      })
    );
    return;
  }

  // Ignore non-text or empty messages
  if (!from || !text) {
    return res.status(200).send(twiml(''));
  }

  console.log(`[whatsapp] message from ${phone} (${name}): ${text.slice(0, 60)}`);

  const messageSid = body.MessageSid ?? '';
  const canUseRest = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';

  // Diagnostic: log which path will be taken
  if (!canUseRest) {
    console.log('[whatsapp] REST credentials not available — will use TwiML-only fallback');
  }

  // Step 1 — Typing indicator (fire-and-forget, marks message as read)
  void sendTypingIndicator(messageSid);

  // DA/NU text fallback: handle order confirm/cancel when customer typed instead of tapping button
  const isConfirmText = /^\s*(da|yes)\s*$/i.test(text);
  const isRejectText  = /^\s*(nu|no)\s*$/i.test(text);

  if (isConfirmText || isRejectText) {
    const sbDaNu = createSupabaseClient();
    const pending = await getPendingOrder(sbDaNu, phone);
    if (pending) {
      if (isConfirmText) {
        try {
          const orderNumber = await createPendingOrderFromPending(sbDaNu, pending);
          const reply = `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`;
          if (canUseRest) {
            res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
            waitUntil(sendRestMessage(from, reply));
          } else {
            return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(reply));
          }
        } catch (err) {
          console.error('[whatsapp] DA order insert failed:', err);
          const errMsg = 'Ne pare rău, nu am putut înregistra comanda. Încearcă din nou.';
          if (canUseRest) {
            res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
            waitUntil(sendRestMessage(from, errMsg));
          } else {
            return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(errMsg));
          }
        }
      } else {
        // NU — pending order already cleared by getPendingOrder
        const reply = '❌ Comanda a fost anulată.';
        if (canUseRest) {
          res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
          waitUntil(sendRestMessage(from, reply));
        } else {
          return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(reply));
        }
      }
      return;
    }
    // No pending order → fall through to normal LLM handling
  }

  if (canUseRest) {
    // Check if this is a new conversation (no history) — only ack on first message
    const sbAck = createSupabaseClient();
    const hasHistory = await hasConversationHistory(sbAck, phone);

    if (!hasHistory) {
      // Step 2 — Acknowledge only on first message of a new conversation
      const ack = detectEnglish(text)
        ? 'Hello, processing your message...'
        : 'Bună ziua, procesăm...';
      res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(ack));
    } else {
      // Returning customer — return empty TwiML, real reply comes via REST
      res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(''));
    }

    // Keep Vercel function alive for async work (buildReplyWithPending + REST send)
    console.log('[whatsapp] starting async reply...');
    waitUntil(
      buildReplyWithPending(phone, name, text)
        .then(async (result) => {
          const sb = createSupabaseClient();

          // If there's a pending order, confirm via Quick Reply buttons or plain text fallback
          if (result.pending) {
            await storePendingOrder(sb, phone, result.pending);
            if (contentSid) {
              const variables = {
                product_name: result.pending.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
                price: result.pending.total_price.toFixed(2),
                pickup_time: result.pending.pickup_time || 'la preluare',
              };
              await sendTemplateMessage(from, contentSid, variables);
              console.log('[whatsapp] sent confirmation template for pending order');
            } else {
              // No contentSid — fall back to plain text DA/NU confirmation
              console.warn('[whatsapp] TWILIO_CONFIRM_CONTENT_SID not set — using DA/NU text fallback');
              const itemsList = result.pending.items.map((i) => `${i.qty}x ${i.name}`).join(', ');
              const fallbackMsg = `Confirmi comanda?\n${itemsList}\n*€${result.pending.total_price.toFixed(2)}*\nRidicare: ${result.pending.pickup_time || 'la preluare'}\n\nRăspunde *DA* sau *NU*.`;
              await sendRestMessage(from, fallbackMsg);
              console.log('[whatsapp] sent plain text DA/NU confirmation fallback');
            }
          } else {
            await sendRestMessage(from, result.reply);
            console.log('[whatsapp] REST reply sent');
          }
        })
        .catch((err) => {
          console.error('[whatsapp] error building reply:', err);
          const fallback = detectEnglish(text)
            ? 'Sorry — something went wrong. Please try again.'
            : 'Ne pare rău, a apărut o eroare. Încearcă din nou.';
          return sendRestMessage(from, fallback);
        })
    );

    return;
  }

  // Fallback: no REST credentials — single TwiML response (original behaviour)
  try {
    const result = await buildReplyWithPending(phone, name, text);
    return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(result.reply));
  } catch (err) {
    console.error('[whatsapp] error:', err);
    const fallback = 'Ne pare rău, a apărut o eroare. Încearcă din nou.';
    return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(fallback));
  }
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
