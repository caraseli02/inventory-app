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
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { validateTwilioSignature } from './lib/twilio-signature.js';
import { getTwilioAuthToken } from '../lib/whatsapp/config.js';
import { twiml, sendRestMessage, sendTemplateMessage, sendTypingIndicator } from '../lib/whatsapp/transport.js';
import { getAbsoluteUrl } from '../lib/whatsapp/url.js';
import {
  buildOverloadedReply,
  buildStoreInfoReply,
  classifyIncomingText,
  detectEnglish,
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  looksLikeOrderRequest,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  maybeRepairOrderReply,
  handleCancellationRequest,
} from '../lib/whatsapp/conversation.js';
import { getInventorySummary } from '../lib/whatsapp/inventory.js';
import { createPendingOrderFromPending, processOrderIntent } from '../lib/whatsapp/order-intent.js';
import type {
  ConversationMessage,
  PendingOrder,
  TwilioBody,
  WhatsAppSimulatorProvider,
  WhatsAppSimulatorResult,
} from '../lib/whatsapp/types.js';

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
    let hasHistory = false;
    try {
      const { data: historyRow } = await sbAck
        .from('conversation_history')
        .select('messages')
        .eq('phone_number', phone)
        .maybeSingle();
      hasHistory = ((historyRow?.messages as unknown[])?.length ?? 0) > 0;
    } catch {
      hasHistory = false;
    }

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

// ─── AI reply builder ────────────────────────────────────────────────────────

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url || !key) {
    console.error('[whatsapp] Supabase not configured: url=%s key=%s', url ? 'SET' : 'MISSING', key ? 'SET' : 'MISSING');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

type ServerSupabaseClient = ReturnType<typeof createSupabaseClient>;

function toSimulationOrderReply(phone: string, name: string, text: string): string | null {
  const trimmed = text.trim();

  if (/ORDER:\s*\{[\s\S]*\}/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        customer_name?: string;
        customer_phone?: string;
        items?: Array<{ name: string; qty: number }>;
        pickup_time?: string;
      };

      const payload = {
        customer_name: parsed.customer_name ?? name,
        customer_phone: parsed.customer_phone ?? phone,
        items: parsed.items ?? [],
        pickup_time: parsed.pickup_time,
      };
      return `ORDER:${JSON.stringify(payload)}`;
    } catch {
      return null;
    }
  }

  return null;
}

export async function buildLocalSimulationReply(phone: string, name: string, text: string): Promise<string> {
  const orderReply = toSimulationOrderReply(phone, name, text);
  if (!orderReply) {
    const result = await buildLocalSimulatorTurn(phone, name, text);
    return result.reply;
  }

  const sb = createSupabaseClient();
  const result = await processOrderIntent(sb, orderReply);
  return result.reply;
}

function buildLocalGeneratedReply(args: {
  text: string;
  inventoryText: string;
  history: ConversationMessage[];
  customerName: string;
  customerPhone: string;
}): string {
  const inventoryLines = args.inventoryText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'));
  const isEn = detectEnglish(args.text);

  const followup = maybeHandleOrderFollowup({
    userText: args.text,
    history: args.history,
    inventoryText: args.inventoryText,
    customerName: args.customerName,
    customerPhone: args.customerPhone,
  });
  if (followup) return followup.text;

  if (!inventoryLines.length) {
    return isEn
      ? 'Sorry — inventory is unavailable right now. Please send the exact product name.'
      : 'Inventarul nu este disponibil acum. Te rog trimite denumirea exactă a produsului.';
  }

  if (looksLikeOrderRequest(args.text)) {
    const options = inventoryLines
      .slice(0, 3)
      .map((line, index) => `${index + 1}) ${line.replace(/^•\s*/, '')}`)
      .join('\n');
    return isEn
      ? `I found multiple matching options. Which one do you want?\n${options}`
      : `Am mai multe opțiuni în inventar. Care anume?\n${options}`;
  }

  if (classifyIncomingText(args.text) === 'browse_inventory') {
    const preview = inventoryLines.slice(0, 5).join('\n');
    return isEn
      ? `Here are some available products:\n${preview}`
      : `Avem câteva produse disponibile:\n${preview}`;
  }

  return inventoryLines.slice(0, 3).join('\n');
}

async function buildLocalSimulatorTurn(phone: string, name: string, text: string): Promise<WhatsAppSimulatorResult> {
  const sb = createSupabaseClient();
  return runConversationTurn({
    sb,
    phone,
    name,
    text,
    llmProvider: 'local',
    repairOrder: true,
    includeDebug: true,
    generateLlmReply: async ({ messages, ...rest }) => buildLocalGeneratedReply({
      text,
      inventoryText: rest.system.includes('INVENTAR LIVE:')
        ? rest.system.split('INVENTAR LIVE:\n')[1]?.split('\n\nREGULI:')[0]?.trim() ?? 'Inventar indisponibil.'
        : 'Inventar indisponibil.',
      history: messages
        .filter((message) => message.role !== 'user' || message.content !== text)
        .map((message) => ({ role: message.role, content: message.content, timestamp: nowIso() })),
      customerName: name,
      customerPhone: phone,
    }),
  });
}

export async function resetConversationHistory(phone: string): Promise<void> {
  const sb = createSupabaseClient();
  await sb
    .from('conversation_history')
    .delete()
    .eq('phone_number', phone);
}

type LlmMessage = { role: 'user' | 'assistant'; content: string };
type GenerateLlmReply = (args: { system: string; messages: LlmMessage[] }) => Promise<string>;

function nowIso(): string {
  return new Date().toISOString();
}

async function runConversationTurn(args: {
  sb: ServerSupabaseClient;
  phone: string;
  name: string;
  text: string;
  llmProvider: WhatsAppSimulatorProvider;
  generateLlmReply: GenerateLlmReply;
  includeDebug: boolean;
  repairOrder: boolean;
}): Promise<WhatsAppSimulatorResult> {
  const intent = classifyIncomingText(args.text);

  if (intent === 'store_info' || intent === 'cancel_order') {
    const reply = intent === 'cancel_order'
      ? await handleCancellationRequest(args.sb, args.phone, args.text)
      : buildStoreInfoReply(args.text);
    try {
      const history = await getHistory(args.sb, args.phone);
      await appendHistory(args.sb, args.phone, history, [
        { role: 'user', content: args.text, timestamp: nowIso() },
        { role: 'assistant', content: reply, timestamp: nowIso() },
      ]);
    } catch (err) {
      console.error('[whatsapp] history append failed:', err);
    }

    return {
      provider: 'local',
      reply,
      ...(args.includeDebug ? { debug: { intent } } : {}),
    };
  }

  const history = await getHistory(args.sb, args.phone);
  const searchCandidatesCurrent = intent === 'product_query' ? extractSearchCandidates(args.text) : [];
  const searchCandidatesFromHistory = intent === 'product_query' ? extractSearchCandidatesFromHistory(history) : [];
  // Merge current + history; de-dup; prefer current-turn terms first (they appear first)
  const searchCandidatesUsed = Array.from(new Set([...searchCandidatesCurrent, ...searchCandidatesFromHistory])).slice(0, 5);
  const inventoryText = await getInventorySummary(args.sb, { intent, text: args.text, candidatesOverride: searchCandidatesUsed });

  const menuSelection = maybeHandleMenuSelection({
    userText: args.text,
    history,
    inventoryText,
    customerName: args.name,
    customerPhone: args.phone,
  });

  let replyTextRaw = '';
  let provider: WhatsAppSimulatorProvider = args.llmProvider;
  let repairedOrder = false;

  if (menuSelection) {
    replyTextRaw = menuSelection.text;
    provider = 'local';
  } else {
    const followup = maybeHandleOrderFollowup({
      userText: args.text,
      history,
      inventoryText,
      customerName: args.name,
      customerPhone: args.phone,
    });

    if (followup) {
      replyTextRaw = followup.text;
      provider = 'local';
    } else {
      const messages: LlmMessage[] = [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: args.text },
      ];

      const system = buildSystemPrompt(args.name, args.phone, inventoryText);
      replyTextRaw = await args.generateLlmReply({ system, messages });

      if (args.repairOrder) {
        // Pass recent history so repair can extract qty/product from earlier turns
        const recentUserMessages = history
          .filter((m) => m.role === 'user')
          .slice(-3)
          .map((m) => m.content)
          .join(' ');
        const repaired = maybeRepairOrderReply({
          replyText: replyTextRaw,
          userText: args.text,
          historyContext: recentUserMessages,
          inventoryText,
          customerName: args.name,
          customerPhone: args.phone,
        });
        replyTextRaw = repaired.text;
        repairedOrder = repaired.repairedOrder;
      }
    }
  }

  const orderResult = await processOrderIntent(args.sb, replyTextRaw);
  const { reply, pending } = orderResult;

  try {
    await appendHistory(args.sb, args.phone, history, [
      { role: 'user', content: args.text, timestamp: nowIso() },
      { role: 'assistant', content: reply, timestamp: nowIso() },
    ]);
  } catch (err) {
    console.error('[whatsapp] history append failed:', err);
  }

  return {
    provider,
    reply,
    ...(pending && { pending }),
    ...(args.includeDebug ? {
      debug: {
        intent,
        inventoryText,
        searchCandidatesCurrent,
        searchCandidatesFromHistory,
        searchCandidatesUsed,
        repairedOrder,
      },
    } : {}),
  };
}

export async function buildSimulatorReply(phone: string, name: string, text: string): Promise<WhatsAppSimulatorResult> {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasOpenAi && !hasAnthropic) {
    return buildLocalSimulatorTurn(phone, name, text);
  }

  if (!hasOpenAi) {
    return { provider: 'anthropic', reply: await buildReply(phone, name, text) };
  }

  const sb = createSupabaseClient();

  try {
    return await runConversationTurn({
      sb,
      phone,
      name,
      text,
      llmProvider: 'openai',
      repairOrder: true,
      includeDebug: true,
      generateLlmReply: async ({ system, messages }) => {
        const model = String(process.env.WHATSAPP_OPENAI_MODEL ?? 'gpt-4.1-nano');
        const result = await generateText({
          model: openai(model),
          system,
          messages,
          maxOutputTokens: 512,
          temperature: 0.2,
        });
        return result.text ?? '';
      },
    });
  } catch (err) {
    if (!hasAnthropic) throw err;
    return await runConversationTurn({
      sb,
      phone,
      name,
      text,
      llmProvider: 'anthropic',
      repairOrder: true,
      includeDebug: true,
      generateLlmReply: async ({ system, messages }) => {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const typedMessages: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
        try {
          const response = await createAnthropicMessageWithRetry(anthropic, {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system,
            messages: typedMessages,
          });
          return response.content[0].type === 'text' ? response.content[0].text : '';
        } catch (inner) {
          if (isAnthropicOverloaded(inner)) return buildOverloadedReply(text);
          throw inner;
        }
      },
    });
  }
}

export async function buildReplyWithPending(
  phone: string,
  name: string,
  text: string
): Promise<WhatsAppSimulatorResult> {
  const sb = createSupabaseClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return runConversationTurn({
    sb,
    phone,
    name,
    text,
    llmProvider: 'anthropic',
    repairOrder: true,
    includeDebug: false,
    generateLlmReply: async ({ system, messages }) => {
      const typedMessages: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await createAnthropicMessageWithRetry(anthropic, {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system,
          messages: typedMessages,
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
      } catch (err) {
        if (isAnthropicOverloaded(err)) return buildOverloadedReply(text);
        throw err;
      }
    },
  });
}

export async function buildReply(phone: string, name: string, text: string): Promise<string> {
  const result = await buildReplyWithPending(phone, name, text);
  return result.reply;
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(name: string, phone: string, inventoryText: string): string {
  const now = new Date();
  const today = now.toLocaleDateString('ro-RO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const storeName    = process.env.STORE_NAME    ?? 'magazinul nostru';
  const storeAddress = process.env.STORE_ADDRESS ?? '';
  const storeHours   = process.env.STORE_HOURS   ?? '';
  const storePhone   = process.env.STORE_PHONE   ?? '';

  return `Ești asistentul WhatsApp al ${storeName}.
${storeAddress ? `Adresă: ${storeAddress}\n` : ''}${storeHours ? `Program: ${storeHours}\n` : ''}${storePhone ? `Telefon: ${storePhone}\n` : ''}

Client curent: ${name} (telefon: ${phone})
Data de azi: ${today}
Mâine: ${tomorrow}

${inventoryText ? `INVENTAR LIVE:\n${inventoryText}\n` : ''}

REGULI:
1. Răspunde în limba clientului (română sau engleză) — auto-detectează.
2. Fii prietenos și concis — maxim 3 propoziții per mesaj.
3. Pentru produse/stoc/preț, folosește doar datele din INVENTAR LIVE (dacă există). Nu inventa produse sau prețuri.
4. Dacă stocul unui produs este ≤ 0, spune că nu este disponibil momentan.
5. Folosește *bold* (asteriscuri) pentru date cheie: număr comandă, preț total, oră ridicare, denumire produs. Nu folosi _, #, ~~ — WhatsApp le afișează ca text literal.
6. Nu spune că “nu poți verifica stocul” dacă INVENTAR LIVE este prezent. Dacă INVENTAR LIVE este “Inventar indisponibil.” atunci cere denumirea exactă a produsului sau spune că inventarul nu e disponibil.
7. Nu inventa ora de ridicare. Dacă clientul spune “mâine la 12:00” sau “vineri la 14:00”, folosește acea informație. Dacă nu menționează ora, întreabă “la ce oră vrei ridicarea?”.
8. Dacă există mai multe produse similare în inventar, cere clientului să aleagă denumirea exactă (copiată din listă).
9. Dacă ești întrebat de adresă/program și nu sunt în mesaj, spune că nu ai informația configurată și recomandă să sune la magazin (dacă există telefon) sau să întrebe în magazin.
10. Când ai TOATE detaliile (denumire exactă produs din inventar + cantitate + oră ridicare), OBLIGATORIU adaugă pe ULTIMA linie, fără text după:
   ORDER:{“customer_name”:”${name}”,”customer_phone”:”${phone}”,”items”:[{“name”:”Nume produs”,”qty”:1}],”pickup_time”:”ora menționată (ex: mâine 12:00, vineri 14:00, 11:00)”}
11. REGULA CRITICĂ: Nu spune “am notat / a fost înregistrată / comanda ta e gata” fără linia ORDER: — dacă nu pui ORDER: comanda NU se salvează în sistem.
12. Linia ORDER: trebuie să fie ULTIMA linie din mesaj. Nu adăuga întrebări sau text după ORDER:.`;
}

function isAnthropicOverloaded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: unknown }).status;
  if (status === 529) return true;

  const message = (err as { message?: unknown }).message;
  if (typeof message === 'string' && message.toLowerCase().includes('overloaded')) return true;

  const errorObj = (err as { error?: unknown }).error;
  if (errorObj && typeof errorObj === 'object') {
    const inner = (errorObj as { error?: unknown }).error;
    if (inner && typeof inner === 'object') {
      const type = (inner as { type?: unknown }).type;
      if (type === 'overloaded_error') return true;
    }
  }

  return false;
}

async function createAnthropicMessageWithRetry(
  anthropic: Anthropic,
  args: Anthropic.MessageCreateParams
): Promise<Anthropic.Messages.Message> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return (await anthropic.messages.create(args)) as Anthropic.Messages.Message;
    } catch (err) {
      const overloaded = isAnthropicOverloaded(err);
      const isLast = attempt === maxAttempts;
      if (!overloaded || isLast) throw err;

      const base = attempt === 1 ? 300 : 900;
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }

  throw new Error('Unreachable');
}

// ─── Pending order storage ────────────────────────────────────────────────────

/**
 * Store a pending order temporarily (awaiting button confirmation).
 * Uses Supabase JSON to avoid schema changes.
 */
async function storePendingOrder(
  sb: ServerSupabaseClient,
  phone: string,
  order: PendingOrder
): Promise<void> {
  try {
    await sb.from('conversation_history').upsert(
      {
        phone_number: phone,
        pending_order: order as unknown,
      },
      { onConflict: 'phone_number' }
    );
  } catch (err) {
    console.error('[whatsapp] failed to store pending order:', err);
  }
}

/**
 * Retrieve and remove a pending order.
 */
async function getPendingOrder(
  sb: ServerSupabaseClient,
  phone: string
): Promise<PendingOrder | null> {
  try {
    const { data } = await sb
      .from('conversation_history')
      .select('pending_order')
      .eq('phone_number', phone)
      .maybeSingle();

    const order = (data?.pending_order ?? null) as PendingOrder | null;

    // Clear pending order after retrieval
    if (order) {
      await sb
        .from('conversation_history')
        .update({ pending_order: null })
        .eq('phone_number', phone);
    }

    return order;
  } catch (err) {
    console.error('[whatsapp] failed to get pending order:', err);
    return null;
  }
}

// ─── Conversation history ─────────────────────────────────────────────────────

async function getHistory(
  sb: ServerSupabaseClient,
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

async function appendHistory(
  sb: ServerSupabaseClient,
  phone: string,
  history: ConversationMessage[],
  newMessages: ConversationMessage[]
): Promise<void> {
  const payload = newMessages.slice(-20);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb as any).rpc('append_conversation_history', {
      p_phone_number: phone,
      p_messages: payload,
    });
    if (!error) return;
  } catch {
    // fall through
  }

  await sb
    .from('conversation_history')
    .upsert(
      { phone_number: phone, messages: [...history, ...payload].slice(-20) },
      { onConflict: 'phone_number' }
    );
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
