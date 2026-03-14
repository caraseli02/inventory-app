import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { validateTwilioSignature } from '../../api/lib/twilio-signature.js';
import { getTwilioAuthToken, getTwilioRestCredentials } from './config.js';
import {
  hasConversationHistory,
  storePendingOrder,
  storePendingProductSelection,
  getPendingProductSelection,
} from './conversation-state.js';
import { detectEnglish } from './conversation.js';
import { createSupabaseClient } from './db.js';
import { checkAndMarkMessageSid } from './dedup.js';
import { buildReplyWithPending } from './llm.js';
import { getDistinctCategories, getProductsByCategory } from './inventory.js';
import {
  applyPendingOrderDecision,
  buildPendingConfirmationText,
  parsePendingTextDecision,
} from './pending-order.js';
import { buildRateLimitReply, checkRateLimit } from './rate-limit.js';
import { sendListPickerTemplate, sendRestMessage, sendTemplateMessage, sendTypingIndicator, twiml } from './transport.js';
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

  const contentSid = process.env.TWILIO_CONFIRM_CONTENT_SID ?? '';
  if (contentSid) {
    const variables = {
      product_name: args.pending.items.map((item) => `${item.qty}x ${item.name}`).join(', '),
      price: args.pending.total_price.toFixed(2),
      pickup_time: args.pending.pickup_time || 'la preluare',
    };
    try {
      await sendTemplateMessage(args.from, contentSid, variables);
      console.log('[whatsapp] sent confirmation template for pending order');
      return;
    } catch (err) {
      console.warn('[whatsapp] template send failed, falling back to DA/NU text:', err);
    }
  } else {
    console.warn('[whatsapp] TWILIO_CONFIRM_CONTENT_SID not set — using DA/NU text fallback');
  }

  await sendRestMessage(args.from, buildPendingConfirmationText(args.pending));
  console.log('[whatsapp] sent plain text DA/NU confirmation fallback');
}

function buildNumberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}) ${item}`).join('\n');
}

async function handleButtonPayload(from: string, phone: string, buttonPayload: string) {
  const sb = createSupabaseClient();

  // browse button → fetch categories → send category list-picker
  if (buttonPayload === 'browse') {
    console.log('[whatsapp] browse button pressed');
    try {
      const categories = await getDistinctCategories(sb);
      const categorySid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

      if (categorySid && categories.length > 0) {
        // Store categories in pending_selection for mapping product_N back to category names
        await storePendingProductSelection(sb, phone, {
          selection_type: 'category_list',
          items: categories,
        });
        console.log('[whatsapp] sending category list-picker:', { itemCount: categories.length });
        await sendListPickerTemplate(from, categorySid, 'Selectează categoria / Choose category', categories);
      } else {
        console.log('[whatsapp] no SID or no categories, falling back to text');
        const categoriesText = categories.length > 0 ? `Categorii:\n${buildNumberedList(categories)}` : 'Nu sunt categorii disponibile.';
        await sendRestMessage(from, categoriesText);
      }
    } catch (err) {
      console.error('[whatsapp] browse button error:', err);
      await sendRestMessage(from, 'Ne pare rău, nu am putut încărca categoriile. Încearcă din nou.');
    }
    return;
  }

  // Handle other welcome buttons
  if (['previous', 'info'].includes(buttonPayload)) {
    const intentText = buttonPayload === 'previous' ? 'comanda anteriora' : 'informatii';
    waitUntil(
      buildReplyWithPending(phone, '', intentText)
        .then(async (result) => {
          if (result.listPicker) {
            const sid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';
            if (sid) {
              await sendListPickerTemplate(from, sid, 'Alegeți / Choose', result.listPicker);
            } else {
              await sendRestMessage(from, buildNumberedList(result.listPicker));
            }
          } else {
            await sendRestMessage(from, result.reply);
          }
        })
        .catch(() => {
          const fallback = 'Ne pare rău, nu am putut procesa cererea. Încearcă din nou.';
          return sendRestMessage(from, fallback);
        })
    );
    return;
  }

  // Handle product_N buttons → look up what was selected in pending_selection
  const productMatch = /^product_(\d+)$/.exec(buttonPayload);
  console.log('[whatsapp] checking for product_N pattern:', {
    buttonPayload,
    matches: !!productMatch,
    regex: '/^product_(\\d+)$/',
  });

  if (productMatch) {
    try {
      const index = parseInt(productMatch[1], 10) - 1;
      const selection = await getPendingProductSelection(sb, phone);

      console.log('[whatsapp] product button received:', {
        payload: buttonPayload,
        index,
        selectionType: selection?.selection_type,
        itemsLength: Array.isArray(selection?.items) ? selection.items.length : 0,
        hasSelection: !!selection,
      });

      if (selection?.selection_type === 'category_list' && Array.isArray(selection.items)) {
        // User selected a category → fetch products in that category
        const selectedCategory = selection.items[index];
        if (!selectedCategory) {
          console.warn('[whatsapp] category index out of range:', { index, itemCount: selection.items.length });
          await sendRestMessage(from, 'Nu am putut identifica categoria. Încearcă din nou.');
          return;
        }

        try {
          const products = await getProductsByCategory(sb, selectedCategory);
          const productSid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';

          console.log('[whatsapp] category selected:', { category: selectedCategory, productCount: products.length });

          if (productSid && products.length > 0) {
            // Store products in pending_selection for mapping product_N back to product names
            await storePendingProductSelection(sb, phone, {
              selection_type: 'product_list',
              items: products,
            });
            await sendListPickerTemplate(from, productSid, 'Selectează produsul / Choose product', products);
          } else {
            console.log('[whatsapp] no products in category or no SID');
            const productsText = products.length > 0 ? `Produse:\n${buildNumberedList(products)}` : `Nu sunt produse disponibile în ${selectedCategory}.`;
            await sendRestMessage(from, productsText);
          }
        } catch (err) {
          console.error('[whatsapp] error fetching products for category:', { category: selectedCategory, error: err });
          await sendRestMessage(from, 'Ne pare rău, nu am putut încărca produsele. Încearcă din nou.');
        }
        return;
      }

      if (selection?.selection_type === 'product_list' && Array.isArray(selection.items)) {
        // User selected a product → send qty template
        const selectedProduct = selection.items[index];
        if (!selectedProduct) {
          console.warn('[whatsapp] product index out of range:', { index, itemCount: selection.items.length });
          await sendRestMessage(from, 'Nu am putut identifica produsul. Încearcă din nou.');
          return;
        }

        const qtySid = process.env.TWILIO_QTY_SID ?? '';
        console.log('[whatsapp] product selected:', { product: selectedProduct, qtySidSet: !!qtySid });

        // Store for qty selection
        await storePendingProductSelection(sb, phone, {
          selection_type: 'awaiting_qty',
          product_name: selectedProduct,
        });

        if (qtySid) {
          try {
            console.log('[whatsapp] sending qty template');
            await sendTemplateMessage(from, qtySid, { product_name: selectedProduct });
            console.log('[whatsapp] qty template sent successfully');
            return;
          } catch (err) {
            console.warn('[whatsapp] qty template send failed, falling back to text:', err);
          }
        }

        const qtyPrompt = `Ce cantitate doriți din *${selectedProduct}*? / How many of *${selectedProduct}* would you like?`;
        await sendRestMessage(from, qtyPrompt);
        return;
      }

      // Fallback if selection context is missing
      console.warn('[whatsapp] no valid selection context for product button:', { payload: buttonPayload, selection });
      await sendRestMessage(from, 'Context pierdut. Încearcă din nou cu "Caut un produs".');
    } catch (err) {
      console.error('[whatsapp] error handling product button:', { payload: buttonPayload, error: err });
      await sendRestMessage(from, 'Ne pare rău, a apărut o eroare. Încearcă din nou.');
    }
    return;
  }

  // confirm/cancel buttons
  if (buttonPayload === 'confirm') {
    try {
      const outcome = await applyPendingOrderDecision(sb, phone, 'confirm');
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
    const outcome = await applyPendingOrderDecision(sb, phone, 'cancel');
    if (outcome.status === 'cancelled') {
      await sendRestMessage(from, '❌ Comanda a fost anulată.');
      return;
    }
    if (outcome.status === 'already_exists_cannot_cancel') {
      await sendRestMessage(from, `ℹ️ Cererea ${outcome.orderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`);
      return;
    }
    await sendRestMessage(from, '⚠️ Comanda a expirat. Te rog trimite din nou.');
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
        // Greeting template (welcome with intent buttons)
        if (result.welcomeTemplate) {
          const sid = process.env.TWILIO_WELCOME_SID ?? '';
          if (sid) {
            try {
              await sendTemplateMessage(args.from, sid);
              return;
            } catch {
              // fall through to plain text fallback
            }
          }
          await sendRestMessage(args.from, result.reply);
          return;
        }

        // PR 4: list-picker for product disambiguation
        if (result.listPicker) {
          const sid = process.env.TWILIO_PRODUCT_LIST_SID ?? '';
          console.log('[whatsapp] list-picker detected:', { hasListPicker: true, sidSet: !!sid, itemCount: result.listPicker.length });
          if (sid) {
            console.log('[whatsapp] attempting to send list-picker template');
            await sendListPickerTemplate(args.from, sid, 'Alegeți produsul / Choose product', result.listPicker);
          } else {
            console.log('[whatsapp] no list-picker SID, using plain text');
            await sendRestMessage(args.from, buildNumberedList(result.listPicker));
          }
          return;
        }

        if (result.pending) {
          // PR 2c: send LLM reply text first, then confirmation template
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
  const replayId = String(req.headers['x-whatsapp-replay-id'] ?? '').trim() || null;

  return runWithReplayContext(replayId, async () => {
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
    const messageSid = body.MessageSid ?? '';

    // Debug logging for incoming Twilio request
    console.log('[whatsapp] incoming request:', {
      hasButtonPayload: !!buttonPayload,
      hasBody: !!text,
      buttonPayload: buttonPayload || '(empty)',
      textPreview: text.slice(0, 50) || '(empty)',
      allBodyKeys: Object.keys(body).filter(k => body[k as keyof TwilioBody]),
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
