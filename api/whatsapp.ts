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

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwilioBody {
  From?: string;        // e.g. "whatsapp:+40123456789"
  Body?: string;        // message text
  ProfileName?: string; // sender's WhatsApp display name
  To?: string;          // your Twilio number
  MessageSid?: string;
  NumMedia?: string;
  ButtonPayload?: string; // Quick Reply button tap: "confirm" | "cancel"
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type WhatsAppSimulatorProvider = 'openai' | 'anthropic' | 'local';

export interface WhatsAppSimulatorResult {
  provider: WhatsAppSimulatorProvider;
  reply: string;
  pending?: PendingOrder;
  debug?: {
    intent: IncomingIntent;
    inventoryText: string;
    searchCandidatesCurrent: string[];
    searchCandidatesFromHistory: string[];
    searchCandidatesUsed: string[];
    repairedOrder: boolean;
  };
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
  const buttonPayload = body.ButtonPayload ?? '';
  const name = body.ProfileName ?? from.replace('whatsapp:', '');

  // Strip "whatsapp:" prefix for DB storage, keep full form for Twilio reply
  const phone = from.replace('whatsapp:', '');

  // Handle button tap (order confirmation/cancellation) — ButtonPayload takes priority over text
  if (buttonPayload) {
    console.log(`[whatsapp] button from ${phone}: ${buttonPayload}`);
    const sb = createSupabaseClient();

    try {
      if (buttonPayload === 'confirm') {
        const pending = await getPendingOrder(sb, phone);
        if (!pending) {
          const response = '⚠️ Comanda a expirat. Te rog trimite din nou.';
          return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(response));
        }

        // Insert the pending order to DB
        const { data: order } = await sb
          .from('orders')
          .insert({
            customer_name: pending.customer_name,
            customer_phone: pending.customer_phone,
            items: pending.items,
            total_price: pending.total_price,
            pickup_time: pending.pickup_time,
            status: 'confirmed',
          })
          .select('order_number')
          .single();

        const orderNumber = (order as { order_number: string } | null)?.order_number ?? '—';
        const response = `✅ Comanda ${orderNumber} a fost înregistrată! Te așteptăm.`;
        return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(response));
      } else if (buttonPayload === 'cancel') {
        // Clear pending order
        await getPendingOrder(sb, phone);
        const response = '❌ Comanda a fost anulată.';
        return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(response));
      }
    } catch (err) {
      console.error('[whatsapp] button handling failed:', err);
      const fallback = 'Ne pare rău, a apărut o eroare.';
      return res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(fallback));
    }
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

  // Step 1 — Typing indicator (fire-and-forget, marks message as read + shows "typing...")
  void sendTypingIndicator(messageSid);

  if (canUseRest) {
    // Check if this is a new conversation (no history) — only show ack on first message
    const sb = createSupabaseClient();
    let hasHistory = false;
    try {
      const { data: history } = await sb
        .from('conversation_history')
        .select('messages')
        .eq('phone_number', phone)
        .maybeSingle();
      hasHistory = ((history?.messages as unknown[])?.length ?? 0) > 0;
    } catch {
      // If query fails, assume new conversation
      hasHistory = false;
    }

    // Step 2 — Acknowledge only on new conversations
    if (!hasHistory) {
      const ack = detectEnglish(text)
        ? '⏳ Got it, processing your message...'
        : '⏳ Am primit, procesăm...';
      // Return acknowledgment via TwiML synchronously, then send result via REST
      res.status(200).setHeader('Content-Type', 'text/xml').send(twiml(ack));
    } else {
      // For ongoing conversations, return empty TwiML (no ack needed)
      res.status(200).send(twiml(''));
    }

    // Keep Vercel function alive for async work (buildReplyWithPending + REST send)
    console.log('[whatsapp] starting async reply...');
    waitUntil(
      buildReplyWithPending(phone, name, text)
        .then(async (result) => {
          const sb = createSupabaseClient();

          // If there's a pending order, send the Quick Reply template instead of text
          if (result.pending && contentSid) {
            // Store the pending order so button tap can retrieve it
            await storePendingOrder(sb, phone, result.pending);

            const variables = {
              product_name: result.pending.items.map((i) => `${i.qty}x ${i.name}`).join(', '),
              price: result.pending.total_price.toFixed(2),
              pickup_time: result.pending.pickup_time || 'la preluare',
            };
            await sendTemplateMessage(from, contentSid, variables);
            console.log('[whatsapp] sent confirmation template for pending order');
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

// ─── TwiML response ───────────────────────────────────────────────────────────

function twiml(message: string): string {
  // Escape XML special chars
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${safe ? `<Message>${safe}</Message>` : ''}</Response>`;
}

// ─── Twilio REST helpers ──────────────────────────────────────────────────────

function twilioRestBase(): { accountSid: string; authToken: string; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken  = process.env.TWILIO_AUTH_TOKEN  ?? '';
  const from       = process.env.TWILIO_FROM_NUMBER ?? '';
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

/**
 * Fire-and-forget typing indicator.
 * Shows "typing..." animation on the recipient's device + marks message as read.
 * Public Beta — silently swallows errors so it never breaks the main flow.
 */
async function sendTypingIndicator(messageSid: string): Promise<void> {
  const creds = twilioRestBase();
  if (!creds || !messageSid) return;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages/${messageSid}/Feedback.json`;
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Outcome=confirmed',
    });
  } catch {
    // non-critical — typing indicator failure must never break reply
  }
}

/**
 * Send a WhatsApp message via the Twilio REST API (not TwiML).
 * Required when we need to send two messages (acknowledgment + result)
 * or when TwiML has already been returned.
 */
async function sendRestMessage(to: string, body: string): Promise<void> {
  const creds = twilioRestBase();
  if (!creds) {
    console.warn('[whatsapp] REST send skipped — TWILIO_ACCOUNT_SID/FROM_NUMBER not configured');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const params = new URLSearchParams({
    To:   to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    From: creds.from.startsWith('whatsapp:') ? creds.from : `whatsapp:${creds.from}`,
    Body: body,
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[whatsapp] REST send failed: %s %s', resp.status, text.slice(0, 200));
  }
}

/**
 * Send a WhatsApp message using a Quick Reply content template.
 * Required for order confirmation flow with buttons.
 */
async function sendTemplateMessage(
  to: string,
  contentSid: string,
  variables?: Record<string, string>
): Promise<void> {
  const creds = twilioRestBase();
  if (!creds) {
    console.warn('[whatsapp] Template send skipped — TWILIO_ACCOUNT_SID/FROM_NUMBER not configured');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const params = new URLSearchParams({
    To:   to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    From: creds.from.startsWith('whatsapp:') ? creds.from : `whatsapp:${creds.from}`,
    ContentSid: contentSid,
    ...(variables && { ContentVariables: JSON.stringify(variables) }),
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[whatsapp] Template send failed: %s %s', resp.status, text.slice(0, 200));
  }
}

// ─── AI reply builder ────────────────────────────────────────────────────────

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url || !key) {
    console.error('[whatsapp] Supabase not configured: url=%s key=%s', url ? 'SET' : 'MISSING', key ? 'SET' : 'MISSING');
  }
  return createClient(url, key);
}

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
    return 'Simulator local: OPENAI_API_KEY / ANTHROPIC_API_KEY lipsesc. Trimite ORDER:{...} sau JSON-ul comenzii pentru creare directă.';
  }

  const sb = createSupabaseClient();
  const result = await processOrderIntent(sb, orderReply);
  return result.reply;
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
  sb: ReturnType<typeof createClient>;
  phone: string;
  name: string;
  text: string;
  llmProvider: Exclude<WhatsAppSimulatorProvider, 'local'>;
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

    return { provider: 'local', reply };
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
    return { provider: 'local', reply: await buildLocalSimulationReply(phone, name, text) };
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

function detectEnglish(text: string): boolean {
  const t = text.toLowerCase();
  return /(address|hours|open|close|phone|contact)/.test(t);
}

function buildStoreInfoReply(text: string): string {
  const storeName = process.env.STORE_NAME ?? 'our store';
  const storeAddress = process.env.STORE_ADDRESS ?? '';
  const storeHours = process.env.STORE_HOURS ?? '';
  const storePhone = process.env.STORE_PHONE ?? '';

  const isEn = detectEnglish(text);

  const hasAny = Boolean(storeAddress || storeHours || storePhone);
  if (!hasAny) {
    return isEn
      ? `Sorry — store info isn't configured yet. Please ask in-store.`
      : `Ne pare rău — informațiile magazinului nu sunt configurate încă. Te rog întreabă în magazin.`;
  }

  const lines: string[] = [];
  lines.push(isEn ? `Store: ${storeName}` : `Magazin: ${storeName}`);
  if (storeAddress) lines.push(isEn ? `Address: ${storeAddress}` : `Adresă: ${storeAddress}`);
  if (storeHours) lines.push(isEn ? `Hours: ${storeHours}` : `Program: ${storeHours}`);
  if (storePhone) lines.push(isEn ? `Phone: ${storePhone}` : `Telefon: ${storePhone}`);
  return lines.join('\n');
}

function buildOverloadedReply(text: string): string {
  return detectEnglish(text)
    ? `Sorry — we're busy right now. Please try again in 1–2 minutes.`
    : `Ne pare rău — sistemul e ocupat acum. Te rog încearcă din nou în 1–2 minute.`;
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

// ─── Inventory summary ───────────────────────────────────────────────────────

type IncomingIntent = 'store_info' | 'browse_inventory' | 'product_query' | 'cancel_order';

function classifyIncomingText(text: string): IncomingIntent {
  // Strip JSON blocks first to avoid false-positive keyword matches (e.g. "customer_phone")
  const stripped = text.replace(/\{[\s\S]*?\}/g, ' ');
  const t = stripped.toLowerCase();
  if (/(anule[az]|anulez|anulati|anulați|cancel|revocare|stornez|nu mai vreau|nu mai vin)/.test(t)) {
    return 'cancel_order';
  }
  if (/(adresă|adresa|address|unde|locați|locati|program|orar|hours|open|închis|inchis|telefon|phone|contact)/.test(t)) {
    return 'store_info';
  }
  if (/(ce av(e|ă)ți|lista|list|inventar|produse|products|available|aveți pe stoc)/.test(t)) {
    return 'browse_inventory';
  }
  return 'product_query';
}

function extractSearchCandidates(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stop = new Set([
    'ai', 'aveti', 'aveți', 'are', 'ati', 'ați', 'as', 'aș', 'as', 'vrea', 'vreau', 'imi', 'îmi', 'mi', 'un', 'o',
    'la', 'in', 'în', 'pe', 'cu', 'de', 'din', 'si', 'și', 'sau', 'care', 'ce', 'cat', 'cât', 'este', 'mai', 'mult',
    'comand', 'comanda', 'comandă', 'comandați', 'comandati', 'doriți', 'doriti', 'doresc', 'vreți', 'vreti',
    'ridic', 'ridica', 'ridicat', 'ridicare', 'ridicarea', 'ridicarii', 'ridicării', 'ora', 'pentru',
    'confirma', 'confirmat', 'confirmati', 'confirmați', 'confirm', 'confirmed',
    'ok', 'okay', 'will', 'get', 'take', 'want', 'buy', 'order', 'pickup', 'pick', 'up', 'for', 'sale', 'im', 'i',
    'do', 'you', 'have', 'any', 'is', 'it', 'there', 'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'with', 'please',
    'price', 'cost', 'stock', 'available',
  ]);

  const candidates = cleaned.filter((w) => w.length >= 3 && !stop.has(w));
  if (!candidates.length) return [];
  const unique = Array.from(new Set(candidates.flatMap((w) => {
    if (w === 'milk') return ['lapte', 'milk'];
    return [w];
  })));
  unique.sort((a, b) => b.length - a.length);
  return unique.slice(0, 3);
}

function extractSearchCandidatesFromHistory(history: ConversationMessage[]): string[] {
  // Check last 4 messages (both user and assistant) for product keywords
  const recent = history.slice(-4);
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const msg = recent[i];
    if (!msg?.content) continue;
    const candidates = extractSearchCandidates(msg.content);
    if (candidates.length) return candidates;
  }
  return [];
}

function normalizeFreeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInventoryNames(inventoryText: string): string[] {
  return inventoryText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, ''))
    .map((line) => line.split(' — ')[0] ?? '')
    .map((left) => left.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
}

/** Map Romanian date words → normalized label for storage. */
const DATE_WORDS: Record<string, string> = {
  azi: 'azi', astazi: 'azi', 'astăzi': 'azi',
  maine: 'mâine', 'mâine': 'mâine',
  poimaine: 'poimâine', 'poimâine': 'poimâine',
  luni: 'luni', marti: 'marți', 'marți': 'marți', miercuri: 'miercuri',
  joi: 'joi', vineri: 'vineri', sambata: 'sâmbătă', 'sâmbătă': 'sâmbătă',
  duminica: 'duminică', 'duminică': 'duminică',
};

/**
 * Extract pickup time (and optional date word) from free text.
 * "maine la 12:00" → "mâine 12:00"
 * "ora 11.30"      → "11:30"
 * "vineri 14:00"   → "vineri 14:00"
 * Returns null if no time found.
 */
function parsePickupDateTime(text: string): string | null {
  const normalized = text.toLowerCase().replace(/\./g, ':');
  const timeMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!timeMatch) return null;
  const timePart = `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}`;

  for (const [key, label] of Object.entries(DATE_WORDS)) {
    if (normalized.includes(key)) return `${label} ${timePart}`;
  }
  return timePart;
}

/** Keep old name for internal callers that only need the time fragment. */
function parsePickupTime(text: string): string | null {
  return parsePickupDateTime(text);
}

/**
 * Normalize a raw pickup_time string from the ORDER JSON before DB insert.
 * "11"          → "11:00"
 * "ora 11"      → "11:00"
 * "maine 12:00" → "mâine 12:00"
 */
function normalizePickupTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Pure hour number e.g. "11"
  if (/^\d{1,2}$/.test(trimmed)) return `${trimmed.padStart(2, '0')}:00`;

  // Delegate to date+time parser for everything else
  return parsePickupDateTime(trimmed) ?? trimmed;
}

function parseSingleQuantity(text: string): number | null {
  const m = text.match(/\b(\d{1,3})\b/);
  if (!m) return null;
  const n = Math.floor(Number(m[1]));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(99, n);
}

function parseMenuChoice(text: string): number | null {
  const m = text.trim().match(/^([1-9])\s*[).]?\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null;
}

function extractMenuOptionsFromAssistantText(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const options: Array<{ idx: number; name: string }> = [];
  for (const line of lines) {
    const m = line.match(/^(\d)\)\s+(.*)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const name = String(m[2] ?? '').trim();
    if (!name) continue;
    options.push({ idx, name });
  }

  if (!options.length) return [];
  options.sort((a, b) => a.idx - b.idx);
  if (options[0]!.idx !== 1) return [];
  for (let i = 0; i < options.length; i += 1) {
    if (options[i]!.idx !== i + 1) return [];
  }
  return options.map((o) => o.name);
}

function findLastMenuOptions(history: ConversationMessage[]): string[] {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    if (!msg?.content) continue;
    const options = extractMenuOptionsFromAssistantText(msg.content);
    if (options.length >= 2) return options;
  }
  return [];
}

function findLastQtyAndPickupTime(history: ConversationMessage[]): { qty: number; pickupTime: string } | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg.role !== 'user') continue;
    if (!msg?.content) continue;
    const qty = parseSingleQuantity(msg.content);
    const pickupTime = parsePickupTime(msg.content);
    if (qty && pickupTime) return { qty, pickupTime };
  }
  return null;
}

function maybeHandleMenuSelection(args: {
  userText: string;
  history: ConversationMessage[];
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string } | null {
  const choice = parseMenuChoice(args.userText);
  if (!choice) return null;

  const ctx = findLastQtyAndPickupTime(args.history);
  if (!ctx) return null;

  const optionsFromMenu = findLastMenuOptions(args.history);
  const optionsFromInventory = extractInventoryNames(args.inventoryText).slice(0, 3);
  const options = optionsFromMenu.length ? optionsFromMenu : optionsFromInventory;
  if (!options.length) return null;

  const chosen = options[choice - 1];
  if (!chosen) return null;

  const payload = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: [{ name: chosen, qty: ctx.qty }],
    pickup_time: ctx.pickupTime,
  };

  const reply = `Perfect — confirm: ${ctx.qty} × ${chosen}, ridicare la ${ctx.pickupTime}.\nORDER:${JSON.stringify(payload)}`;
  return { text: reply };
}

function looksLikeOrderRequest(text: string): boolean {
  const t = normalizeFreeText(text);
  return /(vreau|comand|comanda|order|buy|take|get|i will|yes|da)\b/.test(t);
}

function maybeHandleOrderFollowup(args: {
  userText: string;
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string; createdOrder: boolean } | null {
  if (!looksLikeOrderRequest(args.userText)) return null;
  if (!args.inventoryText || args.inventoryText.trim() === 'Inventar indisponibil.') return null;

  const pickupTime = parsePickupTime(args.userText);
  const qty = parseSingleQuantity(args.userText);
  if (!pickupTime || !qty) return null;

  const names = extractInventoryNames(args.inventoryText);
  if (!names.length) return null;

  const userNorm = normalizeFreeText(args.userText);
  const matches = names.filter((n) => userNorm.includes(normalizeFreeText(n)));

  if (matches.length === 1 || names.length === 1) {
    const chosen = matches[0] ?? names[0]!;
    const payload = {
      customer_name: args.customerName,
      customer_phone: args.customerPhone,
      items: [{ name: chosen, qty }],
      pickup_time: pickupTime,
    };

    const reply = `Perfect — confirm: ${qty} × ${chosen}, ridicare la ${pickupTime}.\nORDER:${JSON.stringify(payload)}`;
    return { text: reply, createdOrder: true };
  }

  const options = names.slice(0, 3);
  const list = options.map((n, i) => `${i + 1}) ${n}`).join('\n');
  const reply = `Am mai multe opțiuni în inventar. Care anume?\n${list}`;
  return { text: reply, createdOrder: false };
}

function maybeRepairOrderReply(args: {
  replyText: string;
  userText: string;
  historyContext?: string;
  inventoryText: string;
  customerName: string;
  customerPhone: string;
}): { text: string; repairedOrder: boolean } {
  if (/ORDER:\s*\{[\s\S]*\}/i.test(args.replyText)) {
    return { text: args.replyText, repairedOrder: false };
  }

  // Combine current message + recent history for extraction fallback
  const fullContext = [args.historyContext, args.userText].filter(Boolean).join(' ');

  if (!looksLikeOrderRequest(fullContext)) {
    return { text: args.replyText, repairedOrder: false };
  }

  const pickupTime = parsePickupTime(args.userText) ?? parsePickupTime(args.historyContext ?? '');
  const qty = parseSingleQuantity(args.userText) ?? parseSingleQuantity(args.historyContext ?? '');
  if (!pickupTime || !qty) {
    return { text: args.replyText, repairedOrder: false };
  }

  const names = extractInventoryNames(args.inventoryText);
  if (!names.length) return { text: args.replyText, repairedOrder: false };

  const contextNorm = normalizeFreeText(fullContext);
  const matches = names.filter((n) => contextNorm.includes(normalizeFreeText(n)));
  if (matches.length !== 1) return { text: args.replyText, repairedOrder: false };

  const payload = {
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    items: [{ name: matches[0], qty }],
    pickup_time: pickupTime,
  };

  const repaired = `${args.replyText.trim()}\nORDER:${JSON.stringify(payload)}`;
  return { text: repaired, repairedOrder: true };
}

async function handleCancellationRequest(
  sb: ReturnType<typeof createClient>,
  phone: string,
  userText: string,
): Promise<string> {
  const isEn = detectEnglish(userText);

  const { data: orders } = await sb
    .from('orders')
    .select('id, order_number, items, pickup_time')
    .eq('customer_phone', phone)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!orders?.length) {
    return isEn
      ? 'No active orders found for your number. If you need help, please call the store.'
      : 'Nu am găsit nicio comandă activă pentru numărul tău. Dacă ai nevoie de ajutor, te rog sună la magazin.';
  }

  const order = orders[0] as { id: string; order_number: string; items: unknown; pickup_time: string | null };

  const { error } = await sb
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id);

  if (error) {
    console.error('[whatsapp] cancellation failed:', error);
    return isEn
      ? 'Sorry — could not cancel your order. Please call the store.'
      : 'Ne pare rău — nu am putut anula comanda. Te rog sună la magazin.';
  }

  return isEn
    ? `Order ${order.order_number} has been cancelled. Sorry you couldn't make it — we're here whenever you need us!`
    : `Comanda ${order.order_number} a fost anulată. Ne pare rău că nu poți ridica comanda — suntem la dispoziție oricând!`;
}

async function getInventorySummary(
  sb: ReturnType<typeof createClient>,
  args: { intent: IncomingIntent; text: string; candidatesOverride?: string[] }
): Promise<string> {
  const makeProductsQuery = () => sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup');

  // ── Browse intent: category-aware sampling ──────────────────────────────────
  if (args.intent === 'browse_inventory') {
    // Fetch all products sorted by category+name for deterministic diversity
    const { data: allProducts } = await makeProductsQuery()
      .order('category', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(200);

    if (!allProducts?.length) {
      console.error('[whatsapp] getInventorySummary: no products returned from Supabase (intent=browse_inventory)');
      return 'Inventar indisponibil.';
    }

    // Sample up to 5 unique-name products per category, 40 total max
    const byCategory: Record<string, ProductRow[]> = {};
    for (const p of allProducts as ProductRow[]) {
      const cat = p.category ?? 'Altele';
      if (!byCategory[cat]) byCategory[cat] = [];
      if (byCategory[cat].length < 5) byCategory[cat].push(p);
    }

    const sampled: ProductRow[] = [];
    for (const rows of Object.values(byCategory)) {
      sampled.push(...rows);
      if (sampled.length >= 40) break;
    }

    const ids = sampled.map((p) => p.id);
    const { data: movements } = await sb
      .from('stock_movements')
      .select('product_id, quantity')
      .in('product_id', ids);

    const stockMap: Record<string, number> = {};
    for (const m of (movements ?? []) as MovementRow[]) {
      stockMap[m.product_id] = (stockMap[m.product_id] ?? 0) + m.quantity;
    }

    const lines: string[] = [];
    for (const [cat, rows] of Object.entries(byCategory)) {
      lines.push(`${cat}:`);
      for (const p of rows) {
        const stock = stockMap[p.id] ?? 0;
        const storePrice = getStorePrice(p);
        const price = storePrice != null ? `€${storePrice.toFixed(2)}` : 'preț nedefinit';
        const availability = stock > 0 ? `stoc: ${stock}` : 'indisponibil';
        lines.push(`  • ${p.name} — ${price}, ${availability}`);
      }
    }
    return lines.join('\n');
  }

  // ── Product query: search by candidates, fallback to name-sorted sample ─────
  const candidates = args.candidatesOverride ?? extractSearchCandidates(args.text);

  let products: unknown[] | null | undefined;
  if (candidates.length) {
    for (const term of candidates) {
      const { data } = await makeProductsQuery().ilike('name', `%${term}%`).limit(20);
      if (data?.length) {
        products = data as unknown[];
        break;
      }
    }
  }
  if (!products?.length) {
    // Fallback: alphabetical sample (not created_at, to avoid category bias)
    const { data } = await makeProductsQuery().order('name', { ascending: true }).limit(20);
    products = data as unknown[] | null | undefined;
  }

  if (!products?.length) {
    console.error('[whatsapp] getInventorySummary: no products returned from Supabase (intent=%s candidates=%j)', args.intent, candidates);
    return 'Inventar indisponibil.';
  }

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
  if (rows[0]) {
    const first = rows[0];
    const firstStock = stockMap[first.id] ?? 0;
    if (firstStock <= 0 && first.category) {
      const { data: sameCategory } = await makeProductsQuery()
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

// ─── Pending order storage ────────────────────────────────────────────────────

/**
 * Store a pending order temporarily (awaiting button confirmation).
 * Uses Supabase JSON to avoid schema changes.
 */
async function storePendingOrder(
  sb: ReturnType<typeof createClient>,
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
  sb: ReturnType<typeof createClient>,
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

export const __private__ = {
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  maybeHandleOrderFollowup,
  maybeHandleMenuSelection,
  extractMenuOptionsFromAssistantText,
  maybeRepairOrderReply,
  getInventorySummary,
  classifyIncomingText,
  extractOrderJson,
  normalizePickupTime,
  parsePickupDateTime,
} as const;

// ─── Order intent ─────────────────────────────────────────────────────────────

/** Extract the full JSON object following ORDER: using brace depth counting. */
function extractOrderJson(text: string): { json: string; startIdx: number } | null {
  const orderIdx = text.search(/ORDER:/i);
  if (orderIdx === -1) return null;
  const braceStart = text.indexOf('{', orderIdx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return { json: text.slice(braceStart, i + 1), startIdx: orderIdx };
    }
  }
  return null;
}

interface PendingOrder {
  customer_name: string;
  customer_phone: string;
  items: Array<{ product_id: string; name: string; qty: number; unit_price: number }>;
  total_price: number;
  pickup_time: string | null;
}

interface ProcessOrderResult {
  reply: string;
  pending?: PendingOrder;
}

async function processOrderIntent(
  sb: ReturnType<typeof createClient>,
  replyText: string
): Promise<ProcessOrderResult> {
  // Match ORDER: anywhere in the reply, using brace-depth counting to handle nested JSON
  const extracted = extractOrderJson(replyText);
  if (!extracted) return { reply: replyText };

  // Strip ORDER:{...} and any trailing text the LLM appended after it
  const stripOrder = (text: string, replacement: string) =>
    text.replace(/\s*ORDER:\{[\s\S]*\}[\s\S]*$/i, `\n${replacement}`).trim();

  try {
    const orderData = JSON.parse(extracted.json) as {
      customer_name: string;
      customer_phone: string;
      items: Array<{ product_id?: string; name: string; qty: number; unit_price?: number }>;
      total_price?: number;
      pickup_time?: string;
    };

    const resolved = await resolveOrderItems(sb, orderData.items);
    const normalizedPickupTime = orderData.pickup_time ? normalizePickupTime(orderData.pickup_time) : null;

    // Store pending order for confirmation flow
    const pending: PendingOrder = {
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      items: resolved.items,
      total_price: resolved.totalPrice,
      pickup_time: normalizedPickupTime,
    };

    // Return pending order — don't insert yet, wait for button confirmation
    const confirmationPrompt = stripOrder(
      replyText,
      `${resolved.items.map((i) => `${i.qty}x ${i.name}`).join('\n')}
€${resolved.totalPrice.toFixed(2)}
Ridicare: ${normalizedPickupTime || 'la preluare'}`
    );

    return { reply: confirmationPrompt, pending };
  } catch (err) {
    console.error('[whatsapp] order creation failed:', err);
    const message = err instanceof Error ? err.message : '';
    if (message.startsWith('AMBIGUOUS_ITEM:')) {
      const rawName = message.slice('AMBIGUOUS_ITEM:'.length).split('|')[0] ?? 'produs';
      return { reply: stripOrder(replyText, `⚠️ Am găsit mai multe produse pentru „${rawName}”. Te rog trimite denumirea exactă.`) };
    }
    if (message.startsWith('NOT_FOUND_ITEM:')) {
      const rawName = message.slice('NOT_FOUND_ITEM:'.length) || 'produsul cerut';
      return { reply: stripOrder(replyText, `⚠️ Nu am găsit „${rawName}” în inventar. Te rog trimite denumirea exactă.`) };
    }
    if (message.startsWith('OUT_OF_STOCK_ITEM:')) {
      const rawName = message.slice('OUT_OF_STOCK_ITEM:'.length) || 'produsul cerut';
      return { reply: stripOrder(replyText, `⚠️ „${rawName}” nu are stoc suficient acum. Te rog ajustează cantitatea.`) };
    }
    return { reply: stripOrder(replyText, '⚠️ Nu am reușit să înregistrez comanda automat. Te rog încearcă din nou.') };
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

async function appendHistory(
  sb: ReturnType<typeof createClient>,
  phone: string,
  history: ConversationMessage[],
  newMessages: ConversationMessage[]
): Promise<void> {
  const payload = newMessages.slice(-20);

  try {
    const { error } = await (sb.rpc(
      'append_conversation_history',
      {
        p_phone_number: phone,
        p_messages: payload as unknown,
      } as Record<string, unknown>
    ) as Promise<{ error: unknown }>);
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
      : await resolveProductByName(sb, name, item.unit_price);

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
  rawName: string,
  targetPrice?: number
): Promise<ProductMatchResult> {
  const query = normalizeProductText(rawName);
  if (!query) return { type: 'not_found' };

  const { data: exactRows } = await sb
    .from('products')
    .select('id, created_at, name, category, price, price_50, price_70, price_100, markup')
    .ilike('name', rawName.trim())
    .limit(10);

  const exact = (exactRows as ProductRow[] | null) ?? [];
  if (exact.length === 1) return { type: 'match', product: exact[0] };

  if (exact.length > 1) {
    // Multiple variants of same product (different prices)
    // If targetPrice provided, pick the matching variant
    if (targetPrice) {
      const match = exact.find((p) => {
        const prices = [p.price, p.price_50, p.price_70, p.price_100].filter((x) => x != null);
        return prices.some((price) => Math.abs(price - targetPrice) < 0.01);
      });
      if (match) return { type: 'match', product: match };
    }
    // Otherwise pick the most recent (highest created_at)
    const sorted = exact.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { type: 'match', product: sorted[0] };
  }

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
