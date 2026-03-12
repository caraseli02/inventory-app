import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { validateTwilioSignature } from '../../api/lib/twilio-signature.js';
import { getTwilioAuthToken, getTwilioRestCredentials } from './config.js';
import {
  clearPendingOrder,
  consumePendingOrder,
  getPendingOrderState,
  hasConversationHistory,
  storePendingOrder,
} from './conversation-state.js';
import { detectEnglish } from './conversation.js';
import { createSupabaseClient } from './db.js';
import { buildReplyWithPending } from './llm.js';
import { createPendingOrderFromPending } from './order-intent.js';
import { sendRestMessage, sendTemplateMessage, sendTypingIndicator, twiml } from './transport.js';
import type { PendingOrder, TwilioBody } from './types.js';
import { getAbsoluteUrl } from './url.js';

function normalizeTwilioParams(body: unknown): Record<string, string> {
  if (typeof body === 'string') {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  if (!body || typeof body !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

function sendTwiml(res: VercelResponse, body: string) {
  return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(body));
}

type PendingTextDecision =
  | { kind: 'confirm'; source: 'exact' | 'interactive' }
  | { kind: 'cancel'; source: 'exact' | 'interactive' };

function normalizeDecisionText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePendingTextDecision(text: string): PendingTextDecision | null {
  const normalizedFull = normalizeDecisionText(text);
  if (/^(da|yes)$/.test(normalizedFull)) return { kind: 'confirm', source: 'exact' };
  if (/^(nu|no)$/.test(normalizedFull)) return { kind: 'cancel', source: 'exact' };

  const lastLine = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!lastLine) return null;

  const normalizedLastLine = normalizeDecisionText(lastLine);
  if (/^(da|yes)\s+confirma?$/.test(normalizedLastLine) || /^confirma$/.test(normalizedLastLine)) {
    return { kind: 'confirm', source: 'interactive' };
  }
  if (/^anuleaza$/.test(normalizedLastLine) || /^(nu|no)\s+anuleaza$/.test(normalizedLastLine) || /^cancel$/.test(normalizedLastLine)) {
    return { kind: 'cancel', source: 'interactive' };
  }

  return null;
}

async function replyViaAvailableChannel(args: {
  res: VercelResponse;
  from: string;
  message: string;
  canUseRest: boolean;
}) {
  if (args.canUseRest) {
    sendTwiml(args.res, '');
    waitUntil(sendRestMessage(args.from, args.message));
    return;
  }

  sendTwiml(args.res, args.message);
}

async function findLatestPendingOrderNumberByPhone(sb: ReturnType<typeof createSupabaseClient>, phone: string): Promise<string | null> {
  try {
    // Supabase's generated generic type for chained order lookups gets too deep here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('orders') as any)
      .select('order_number, status, created_at')
      .eq('customer_phone', phone)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    const orderNumber = (data?.[0] as { order_number?: string } | undefined)?.order_number;
    return orderNumber ? String(orderNumber) : null;
  } catch (err) {
    console.error('[whatsapp] failed to find latest pending order:', err);
    return null;
  }
}

async function handlePendingTextDecision(args: {
  res: VercelResponse;
  from: string;
  phone: string;
  text: string;
  canUseRest: boolean;
}) {
  const decision = parsePendingTextDecision(args.text);
  if (!decision) return false;
  const isConfirmText = decision.kind === 'confirm';

  const sb = createSupabaseClient();
  const pendingState = await (isConfirmText ? consumePendingOrder(sb, args.phone) : getPendingOrderState(sb, args.phone));
  const existingOrderNumber = pendingState.status !== 'fresh'
    ? await findLatestPendingOrderNumberByPhone(sb, args.phone)
    : null;

  if (pendingState.status === 'expired') {
    if (existingOrderNumber) {
      await replyViaAvailableChannel({
        res: args.res,
        from: args.from,
        canUseRest: args.canUseRest,
        message: isConfirmText
          ? `✅ Cererea ${existingOrderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`
          : `ℹ️ Cererea ${existingOrderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`,
      });
      return true;
    }
    await replyViaAvailableChannel({
      res: args.res,
      from: args.from,
      canUseRest: args.canUseRest,
      message: '⚠️ Comanda a expirat. Te rog trimite din nou.',
    });
    return true;
  }
  if (pendingState.status === 'missing') {
    if (existingOrderNumber) {
      await replyViaAvailableChannel({
        res: args.res,
        from: args.from,
        canUseRest: args.canUseRest,
        message: isConfirmText
          ? `✅ Cererea ${existingOrderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`
          : `ℹ️ Cererea ${existingOrderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`,
      });
      return true;
    }
    return decision.source === 'interactive'
      ? replyViaAvailableChannel({
        res: args.res,
        from: args.from,
        canUseRest: args.canUseRest,
        message: '⚠️ Comanda a expirat. Te rog trimite din nou.',
      }).then(() => true)
      : false;
  }

  if (isConfirmText) {
    try {
      const orderNumber = await createPendingOrderFromPending(sb, pendingState.order);
      await replyViaAvailableChannel({
        res: args.res,
        from: args.from,
        canUseRest: args.canUseRest,
        message: `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`,
      });
    } catch (err) {
      console.error('[whatsapp] DA order insert failed:', err);
      await storePendingOrder(sb, args.phone, pendingState.order);
      await replyViaAvailableChannel({
        res: args.res,
        from: args.from,
        canUseRest: args.canUseRest,
        message: 'Ne pare rău, nu am putut înregistra comanda. Încearcă din nou.',
      });
    }
    return true;
  }

  await clearPendingOrder(sb, args.phone);
  await replyViaAvailableChannel({
    res: args.res,
    from: args.from,
    canUseRest: args.canUseRest,
    message: '❌ Comanda a fost anulată.',
  });
  return true;
}

async function sendPendingOrderConfirmation(args: {
  from: string;
  phone: string;
  pending: PendingOrder;
}) {
  const sb = createSupabaseClient();
  await storePendingOrder(sb, args.phone, args.pending);

  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';
  if (contentSid) {
    const variables = {
      product_name: args.pending.items.map((item) => `${item.qty}x ${item.name}`).join(', '),
      price: args.pending.total_price.toFixed(2),
      pickup_time: args.pending.pickup_time || 'la preluare',
    };
    await sendTemplateMessage(args.from, contentSid, variables);
    console.log('[whatsapp] sent confirmation template for pending order');
    return;
  }

  console.warn('[whatsapp] TWILIO_CONFIRM_CONTENT_SID not set — using DA/NU text fallback');
  const itemsList = args.pending.items.map((item) => `${item.qty}x ${item.name}`).join(', ');
  const fallbackMsg = `Confirmi comanda?\n${itemsList}\n*€${args.pending.total_price.toFixed(2)}*\nRidicare: ${args.pending.pickup_time || 'la preluare'}\n\nRăspunde *DA* sau *NU*.`;
  await sendRestMessage(args.from, fallbackMsg);
  console.log('[whatsapp] sent plain text DA/NU confirmation fallback');
}

async function handleButtonPayload(from: string, phone: string, buttonPayload: string) {
  const sb = createSupabaseClient();

  if (buttonPayload === 'confirm') {
    const pendingState = await consumePendingOrder(sb, phone);
    if (pendingState.status !== 'fresh') {
      const existingOrderNumber = await findLatestPendingOrderNumberByPhone(sb, phone);
      if (existingOrderNumber) {
        await sendRestMessage(from, `✅ Cererea ${existingOrderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`);
        return;
      }
      await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
      return;
    }

    try {
      const orderNumber = await createPendingOrderFromPending(sb, pendingState.order);
      await sendRestMessage(from, `✅ Cererea ${orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`);
    } catch (err) {
      console.error('[whatsapp] button confirm order insert failed:', err);
      await storePendingOrder(sb, phone, pendingState.order);
      await sendRestMessage(from, 'Ne pare rău, nu am putut înregistra comanda. Încearcă din nou.');
    }
    return;
  }

  if (buttonPayload === 'cancel') {
    const pendingState = await consumePendingOrder(sb, phone);
    if (pendingState.status !== 'fresh') {
      const existingOrderNumber = await findLatestPendingOrderNumberByPhone(sb, phone);
      if (existingOrderNumber) {
        await sendRestMessage(from, `ℹ️ Cererea ${existingOrderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`);
        return;
      }
      await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
      return;
    }

    await sendRestMessage(from, '❌ Comanda a fost anulată.');
  }
}

async function handleRestConversation(args: {
  res: VercelResponse;
  from: string;
  phone: string;
  name: string;
  text: string;
  messageSid: string;
}) {
  const sb = createSupabaseClient();
  const hasHistory = await hasConversationHistory(sb, args.phone);
  const ack = detectEnglish(args.text)
    ? 'Hello, processing your message...'
    : 'Bună ziua, procesăm...';

  if (!hasHistory) sendTwiml(args.res, ack);
  else sendTwiml(args.res, '');

  void sendTypingIndicator(args.messageSid);
  console.log('[whatsapp] starting async reply...');

  waitUntil(
    buildReplyWithPending(args.phone, args.name, args.text)
      .then(async (result) => {
        if (result.pending) {
          await sendPendingOrderConfirmation({
            from: args.from,
            phone: args.phone,
            pending: result.pending,
          });
          return;
        }

        await sendRestMessage(args.from, result.reply);
        console.log('[whatsapp] REST reply sent');
      })
      .catch((err) => {
        console.error('[whatsapp] error building reply:', err);
        const fallback = detectEnglish(args.text)
          ? 'Sorry — something went wrong. Please try again.'
          : 'Ne pare rău, a apărut o eroare. Încearcă din nou.';
        return sendRestMessage(args.from, fallback);
      })
  );
}

async function handleTwimlConversation(args: {
  res: VercelResponse;
  phone: string;
  name: string;
  text: string;
}) {
  try {
    const result = await buildReplyWithPending(args.phone, args.name, args.text);
    return sendTwiml(args.res, result.reply);
  } catch (err) {
    console.error('[whatsapp] error:', err);
    return sendTwiml(args.res, 'Ne pare rău, a apărut o eroare. Încearcă din nou.');
  }
}

export default async function webhookHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const authToken = getTwilioAuthToken();
  if (!authToken) {
    console.error('[whatsapp] Missing TWILIO_AUTH_TOKEN (required for signature validation)');
    return res.status(500).json({ error: 'Twilio not configured' });
  }

  const isValid = validateTwilioSignature({
    authToken,
    url: getAbsoluteUrl(req),
    params: normalizeTwilioParams(req.body),
    signature: String(req.headers['x-twilio-signature'] ?? ''),
  });

  if (!isValid) {
    console.warn('[whatsapp] Invalid or missing Twilio signature');
    return res.status(403).end();
  }

  const body = req.body as TwilioBody;
  const from = body.From ?? '';
  const text = (body.Body ?? '').trim();
  const buttonPayload = body.ButtonPayload ?? '';
  const phone = from.replace('whatsapp:', '');
  const name = body.ProfileName ?? phone;

  if (buttonPayload) {
    console.log(`[whatsapp] button from ${phone}: ${buttonPayload}`);
    sendTwiml(res, '');
    waitUntil(
      handleButtonPayload(from, phone, buttonPayload).catch(async (err) => {
        console.error('[whatsapp] button handling failed:', err);
        await sendRestMessage(from, 'Ne pare rău, a apărut o eroare.');
      })
    );
    return;
  }

  if (!from || !text) {
    return res.status(200).send(twiml(''));
  }

  console.log(`[whatsapp] message from ${phone} (${name}): ${text.slice(0, 60)}`);

  const canUseRest = Boolean(getTwilioRestCredentials());
  if (!canUseRest) {
    console.log('[whatsapp] REST credentials not available — will use TwiML-only fallback');
  }

  if (await handlePendingTextDecision({ res, from, phone, text, canUseRest })) {
    return;
  }

  if (canUseRest) {
    return handleRestConversation({
      res,
      from,
      phone,
      name,
      text,
      messageSid: body.MessageSid ?? '',
    });
  }

  return handleTwimlConversation({ res, phone, name, text });
}
