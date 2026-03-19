import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { validateTwilioSignature } from '../../api/lib/twilio-signature.js';
import { getTwilioAuthToken, getTwilioRestCredentials } from './config.js';
import {
  getPendingProductSelection,
  hasConversationHistory,
  peekPendingOrder,
  storePendingOrder,
  storePendingProductSelection,
} from './conversation-state.js';
import { classifyIncomingText, detectEnglish } from './conversation.js';
import { createSupabaseClient, type ServerSupabaseClient } from './db.js';
import { checkAndMarkMessageSid } from './dedup.js';
import { buildReplyWithPending } from './llm.js';
import {
  applyPendingOrderDecision,
  buildPendingConfirmationText,
  parsePendingTextDecision,
} from './pending-order.js';
import { buildRateLimitReply, checkRateLimit } from './rate-limit.js';
import {
  buildNumberedList,
  CartItem,
  clearPendingSelection,
  findMatchingCategory,
  handleCartPickupTime,
  handleCategorySelected,
  handleProductSelected,
  handleQtyInput,
  resolveSelectionByIndex,
  sendCategoryPicker,
} from './selection-resolver.js';
import { sendConfirmPrompt } from './confirm-prompt.js';
import { sendRestMessage, sendTypingIndicator, twiml } from './transport.js';
import type { PendingOrder, TwilioBody } from './types.js';
import { getAbsoluteUrl } from './url.js';
import { isReplayRequest, runWithReplayContext } from './replay-context.js';

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

function isSuccessfulPendingOrderDecision(outcome: Awaited<ReturnType<typeof applyPendingOrderDecision>>): boolean {
  return outcome.status === 'confirmed' || outcome.status === 'cancelled';
}

function parseIsoMs(value: unknown): number | null {
  const ms = new Date(String(value ?? '')).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

async function maybeClearSelectionForPendingOrderDecision(args: {
  sb: ServerSupabaseClient;
  phone: string;
  pendingOrderCreatedAt: string | null;
}) {
  const pendingMs = parseIsoMs(args.pendingOrderCreatedAt);
  if (pendingMs === null) return;

  const selection = await getPendingProductSelection(args.sb, args.phone);
  if (!selection || Object.keys(selection).length === 0) return;

  const selectionMs = parseIsoMs((selection as Record<string, unknown>).created_at);
  // If we can't confidently prove the selection predates the pending order,
  // preserve it (avoid wiping a newer cart flow).
  if (selectionMs === null) return;

  if (selectionMs <= pendingMs) {
    await clearPendingSelection(args.sb, args.phone);
  }
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

async function handlePendingTextDecision(args: {
  res: VercelResponse;
  from: string;
  phone: string;
  text: string;
  canUseRest: boolean;
}) {
  const decision = parsePendingTextDecision(args.text);
  if (!decision) return false;

  const sb = createSupabaseClient();
  try {
    const outcome = await applyPendingOrderDecision(sb, args.phone, decision.kind);

    if (outcome.status === 'missing' && decision.source !== 'interactive') {
      return false;
    }

    const message = outcome.status === 'confirmed'
      ? `✅ Cererea ${outcome.orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`
      : outcome.status === 'cancelled'
        ? '❌ Comanda a fost anulată.'
        : outcome.status === 'already_confirmed'
          ? `✅ Cererea ${outcome.orderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`
          : outcome.status === 'already_exists_cannot_cancel'
            ? `ℹ️ Cererea ${outcome.orderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`
            : '⚠️ Comanda a expirat. Te rog trimite din nou.';

    await replyViaAvailableChannel({
      res: args.res,
      from: args.from,
      canUseRest: args.canUseRest,
      message,
    });
    return true;
  } catch {
    await replyViaAvailableChannel({
      res: args.res,
      from: args.from,
      canUseRest: args.canUseRest,
      message: 'Ne pare rău, nu am putut înregistra comanda. Încearcă din nou.',
    });
    return true;
  }
}

async function sendPendingOrderConfirmation(args: {
  from: string;
  phone: string;
  pending: PendingOrder;
}) {
  const sb = createSupabaseClient();
  await storePendingOrder(sb, args.phone, args.pending);
  await sendConfirmPrompt({
    to: args.from,
    pending: args.pending,
    textFallback: buildPendingConfirmationText(args.pending),
  });
}


async function handleButtonPayload(from: string, phone: string, buttonPayload: string) {
  const sb = createSupabaseClient();
  console.log('[whatsapp] [BUTTON] handling payload:', { buttonPayload, phone });

  // Legacy list-picker callbacks (from old interactive messages): product_N
  const legacyPick = /^\s*product_(\d+)\s*$/.exec(buttonPayload);
  if (legacyPick) {
    const index = Math.max(0, parseInt(legacyPick[1], 10) - 1);
    const result = await resolveSelectionByIndex(sb, phone, index);

    if (result.outcome === 'category_selected') {
      await handleCategorySelected({ sb, from, phone, category: result.category, cart: result.cart });
      return;
    }
    if (result.outcome === 'product_selected') {
      await handleProductSelected({ sb, from, phone, product: result.product, cart: result.cart });
      return;
    }
    if (result.outcome === 'index_out_of_range') {
      await sendRestMessage(from, 'Selecția nu este validă. Încearcă din nou.');
      return;
    }
    if (result.outcome === 'expired') {
      await sendRestMessage(from, 'Selecția a expirat. Încearcă din nou cu "Caut un produs".');
      return;
    }

    await sendRestMessage(from, 'Context pierdut. Încearcă din nou cu "Caut un produs".');
    return;
  }

  // confirm/cancel buttons (DA/NU)
  if (buttonPayload === 'confirm') {
    try {
      const pendingBefore = await peekPendingOrder(sb, phone);
      const outcome = await applyPendingOrderDecision(sb, phone, 'confirm');
      if (isSuccessfulPendingOrderDecision(outcome)) {
        await maybeClearSelectionForPendingOrderDecision({
          sb,
          phone,
          pendingOrderCreatedAt: pendingBefore?.pending_order_created_at ?? null,
        });
      }
      if (outcome.status === 'confirmed') {
        await sendRestMessage(from, `✅ Cererea ${outcome.orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`);
        return;
      }
      if (outcome.status === 'already_confirmed') {
        await sendRestMessage(from, `✅ Cererea ${outcome.orderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`);
        return;
      }
      await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
    } catch {
      await sendRestMessage(from, 'Ne pare rău, nu am putut înregistra comanda. Încearcă din nou.');
    }
    return;
  }

  if (buttonPayload === 'cancel') {
    try {
      const pendingBefore = await peekPendingOrder(sb, phone);
      const outcome = await applyPendingOrderDecision(sb, phone, 'cancel');
      if (isSuccessfulPendingOrderDecision(outcome)) {
        await maybeClearSelectionForPendingOrderDecision({
          sb,
          phone,
          pendingOrderCreatedAt: pendingBefore?.pending_order_created_at ?? null,
        });
      }
      if (outcome.status === 'cancelled') {
        await sendRestMessage(from, '❌ Comanda a fost anulată.');
        return;
      }
      if (outcome.status === 'already_exists_cannot_cancel') {
        await sendRestMessage(from, `ℹ️ Cererea ${outcome.orderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`);
        return;
      }
      await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
    } catch {
      await sendRestMessage(from, 'Ne pare rău, nu am putut anula comanda. Încearcă din nou.');
    }
    return;
  }

  // Catch-all: unrecognized button payload — log and send fallback
  console.warn('[whatsapp] [BUTTON] unrecognized payload, no handler matched:', { buttonPayload, phone });
  await sendRestMessage(from, 'Nu am înțeles selecția. Încearcă din nou sau trimite un mesaj text.');
}

/** Parse a single digit (1-9) from user text, e.g. "1", "2)", "3." */
function parseNumericChoice(text: string): number | null {
  const match = text.trim().match(/^([1-9]|10)\s*[).]?\s*$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 10 ? value : null;
}

/**
 * Try to intercept text input for deterministic state-machine flows before falling through to LLM.
 * Returns true if intercepted (handled), false if should continue to LLM.
 */
async function tryTextStateInterception(args: {
  sb: ServerSupabaseClient;
  from: string;
  phone: string;
  text: string;
  customerName: string;
  customerPhone: string;
}): Promise<boolean> {
  const intent = classifyIncomingText(args.text);

  // 0a. awaiting_qty state → structured qty handler (before numeric choice so "1" is treated as qty not menu)
  const qtyIntercepted = await handleQtyInput({ sb: args.sb, from: args.from, phone: args.phone, text: args.text });
  if (qtyIntercepted) {
    console.log('[whatsapp] [TEXT_INTERCEPT] awaiting_qty: qty captured, showing add-more/confirm menu');
    return true;
  }

  // 0b. awaiting_pickup_time state → parse time and create order
  const pickupIntercepted = await handleCartPickupTime({
    sb: args.sb, from: args.from, phone: args.phone, text: args.text,
    customerName: args.customerName, customerPhone: args.customerPhone,
  });
  if (pickupIntercepted) {
    console.log('[whatsapp] [TEXT_INTERCEPT] awaiting_pickup_time: order created from cart');
    return true;
  }

  // 0c. building_order state: "1" = add more, "2" = confirm cart
  const currentSelection = await getPendingProductSelection(args.sb, args.phone);
  if (currentSelection?.selection_type === 'building_order') {
    const choice = parseNumericChoice(args.text);
    if (choice === 1) {
      await sendCategoryPicker({ sb: args.sb, from: args.from, phone: args.phone, preserveCart: true });
      return true;
    }
    if (choice === 2) {
      const cart = (currentSelection.cart as CartItem[] | undefined) ?? [];
      const stored = await storePendingProductSelection(args.sb, args.phone, { selection_type: 'awaiting_pickup_time', cart, created_at: new Date().toISOString() });
      if (!stored) {
        await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
        return true;
      }
      await sendRestMessage(args.from, '🕐 La ce oră doriți să ridicați comanda? (ex: 18:30)');
      return true;
    }
    // Any other text while building_order: fall through to LLM
  }

  // 1. browse_inventory → category list-picker
  if (intent === 'browse_inventory') {
    console.log('[whatsapp] [TEXT_INTERCEPT] browse_inventory detected, sending category picker');
    try {
      await sendCategoryPicker({ sb: args.sb, from: args.from, phone: args.phone });
      return true;
    } catch (err) {
      console.error('[whatsapp] [TEXT_INTERCEPT] category picker failed:', err);
      return false; // fall through to LLM
    }
  }

  // 2. Numeric input ("1", "2") → resolve against pending_selection
  const numericChoice = parseNumericChoice(args.text);
  if (numericChoice !== null) {
    const result = await resolveSelectionByIndex(args.sb, args.phone, numericChoice - 1);
    console.log('[whatsapp] [TEXT_INTERCEPT] numeric choice:', { choice: numericChoice, outcome: result.outcome });

    if (result.outcome === 'category_selected') {
      await handleCategorySelected({ sb: args.sb, from: args.from, phone: args.phone, category: result.category, cart: result.cart });
      return true;
    }
    if (result.outcome === 'product_selected') {
      await handleProductSelected({ sb: args.sb, from: args.from, phone: args.phone, product: result.product, cart: result.cart });
      return true;
    }
    if (result.outcome === 'expired') {
      // Don't intercept — let LLM handle it (might be "1 bucata" etc.)
      console.log('[whatsapp] [TEXT_INTERCEPT] selection expired, falling through to LLM');
    }
    // no_context or index_out_of_range: fall through to LLM
  }

  // 3. Category-name text (e.g. "Carne") → product list-picker
  if (intent === 'product_query') {
    try {
      const matchedCategory = await findMatchingCategory(args.sb, args.text);
      if (matchedCategory) {
        console.log('[whatsapp] [TEXT_INTERCEPT] category name matched:', matchedCategory);
        await handleCategorySelected({ sb: args.sb, from: args.from, phone: args.phone, category: matchedCategory });
        return true;
      }
    } catch (err) {
      console.error('[whatsapp] [TEXT_INTERCEPT] category match failed:', err);
    }
  }

  return false;
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
    // Try deterministic state interception first (browse, numeric, category-name, cart flows)
    tryTextStateInterception({ sb, from: args.from, phone: args.phone, text: args.text, customerName: args.name, customerPhone: args.phone })
      .then(async (intercepted) => {
        if (intercepted) {
          console.log('[whatsapp] text intercepted by state machine');
          return undefined;
        }
        return buildReplyWithPending(args.phone, args.name, args.text);
      })
      .then(async (result) => {
        if (!result) return; // already handled by interception

        // Text-only product disambiguation (numbered list)
        if (result.listPicker) {
          // Store selection so product_N button clicks resolve correctly
          const stored = await storePendingProductSelection(sb, args.phone, {
            selection_type: 'product_list',
            items: result.listPicker,
            cart: [],
            created_at: new Date().toISOString(),
          });
          if (!stored) {
            await sendRestMessage(args.from, 'A apărut o eroare. Încearcă din nou.');
            return;
          }
          await sendRestMessage(args.from, buildNumberedList(result.listPicker));
          return;
        }

        if (result.pending) {
          if (result.reply) {
            await sendRestMessage(args.from, result.reply);
          }
          await sendPendingOrderConfirmation({
            from: args.from,
            phone: args.phone,
            pending: result.pending,
          });
          return;
        }

        await sendRestMessage(args.from, result.reply);
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
  // Replay mode is only allowed outside production to prevent dedup/rate-limit bypass.
  // When WHATSAPP_REPLAY_SECRET is set, the caller must also provide a matching
  // x-whatsapp-replay-secret header — this prevents accidental activation in staging.
  // On Vercel, NODE_ENV is typically "production" even for Preview deployments.
  // Treat only VERCEL_ENV=production as production when VERCEL_ENV is present.
  const vercelEnv = process.env.VERCEL_ENV;
  const isProduction = vercelEnv ? vercelEnv === 'production' : process.env.NODE_ENV === 'production';
  // Only enforce Twilio signature validation in production by default.
  // Preview deployments change URLs frequently, and Twilio signs against the exact URL string.
  const shouldValidateSignature = isProduction || process.env.WHATSAPP_VALIDATE_TWILIO_SIGNATURE === 'true';
  const replaySecret = process.env.WHATSAPP_REPLAY_SECRET;
  const replayId = (() => {
    if (isProduction) return null;
    if (replaySecret && req.headers['x-whatsapp-replay-secret'] !== replaySecret) return null;
    return String(req.headers['x-whatsapp-replay-id'] ?? '').trim() || null;
  })();

  return runWithReplayContext(replayId, async () => {
    if (req.method !== 'POST') {
      return res.status(405).end();
    }

    if (shouldValidateSignature) {
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
    }

    const body = req.body as TwilioBody & { ListId?: string; ListTitle?: string };
    const from = body.From ?? '';
    let text = (body.Body ?? '').trim();
    let buttonPayload = body.ButtonPayload ?? '';

    // Handle Twilio list-picker responses: they come as Body text, not ButtonPayload
    // ListId field indicates this is from a list-picker template
    const isListPickerResponse = !!(body.ListId && text.trim().match(/^product_\d+$/));
    console.log('[whatsapp] [WEBHOOK] checking for list-picker response:', {
      hasListId: !!body.ListId,
      textValue: text,
      textMatches: !!text.match(/^product_\d+$/),
      isListPickerResponse,
    });

    if (isListPickerResponse) {
      buttonPayload = text;  // Treat the product_N ID as a button payload
      text = '';  // Clear text so it's not processed as regular message
      console.log('[whatsapp] [WEBHOOK] detected list-picker response, treating as button payload:', buttonPayload);
    }

    const phone = from.replace('whatsapp:', '');
    const name = body.ProfileName ?? phone;
    const messageSid = body.MessageSid ?? '';

    // Debug logging for incoming Twilio request
    console.log('[whatsapp] incoming request:', {
      hasButtonPayload: !!buttonPayload,
      hasBody: !!text,
      isListPickerResponse,
      buttonPayload: buttonPayload || '(empty)',
      textPreview: text.slice(0, 50) || '(empty)',
    });

    // PR 1a: MessageSid deduplication — bypass for replay requests (replayId is non-null for replays)
    if (!replayId && messageSid) {
      const dedupClient = createSupabaseClient();
      const isDuplicate = await checkAndMarkMessageSid(dedupClient, messageSid);
      if (isDuplicate) {
        console.log(`[whatsapp] duplicate MessageSid ${messageSid} — skipping`);
        return res.status(200).send(twiml(''));
      }
    }

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
      console.log('[whatsapp] skipping: missing from or text', { from: !!from, text: !!text });
      return res.status(200).send(twiml(''));
    }

    console.log(`[whatsapp] message from ${phone} (${name}): ${text.slice(0, 60)}`);

    const canUseRest = Boolean(getTwilioRestCredentials()) || isReplayRequest();
    if (!canUseRest) {
      console.log('[whatsapp] REST credentials not available — will use TwiML-only fallback');
    }

    // PR 1b: per-phone rate limiting — bypass for replay requests (replayId is non-null for replays)
    if (!replayId) {
      const rateLimitClient = createSupabaseClient();
      const { allowed } = await checkRateLimit(rateLimitClient, phone);
      if (!allowed) {
        console.warn(`[whatsapp] rate limit exceeded for ${phone}`);
        await replyViaAvailableChannel({
          res,
          from,
          message: buildRateLimitReply(),
          canUseRest,
        });
        return;
      }
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
  });
}
