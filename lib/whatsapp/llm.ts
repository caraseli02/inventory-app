import Anthropic from '@anthropic-ai/sdk';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { appendHistory, getHistory, getLanguage, resetConversationHistory, setLanguage } from './conversation-state.js';
import {
  buildOverloadedReply,
  buildStoreInfoReply,
  classifyIncomingText,
  detectEnglish,
  extractInventoryNames,
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  handleCancellationRequest,
  looksLikeOrderRequest,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  maybeRepairOrderReply,
} from './conversation.js';
import { createSupabaseClient, type ServerSupabaseClient } from './db.js';
import { getInventorySummary } from './inventory.js';
import { processOrderIntent } from './order-intent.js';
import { buildSystemPrompt } from './prompts.js';
import type {
  ConversationMessage,
  WhatsAppSimulatorProvider,
  WhatsAppSimulatorResult,
} from './types.js';

type LlmMessage = { role: 'user' | 'assistant'; content: string };
type GenerateLlmReply = (args: { system: string; messages: LlmMessage[] }) => Promise<string>;

function nowIso(): string {
  return new Date().toISOString();
}

export async function runConversationTurn(args: {
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

  // Greeting fast-path: canned bilingual reply, no LLM call, no inventory fetch
  if (intent === 'greeting') {
    const storedLang = await getLanguage(args.sb, args.phone).catch(() => 'ro');
    const isEn = storedLang === 'en' || detectEnglish(args.text);
    const reply = isEn
      ? 'Hello! How can I help you today?'
      : 'Bună ziua! Cu ce vă pot ajuta?';
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

  // Reset fast-path: clear history, canned bilingual reply
  if (intent === 'reset') {
    await resetConversationHistory(args.phone);
    const isEn = detectEnglish(args.text);
    const reply = isEn
      ? 'Conversation reset. How can I help you?'
      : 'Conversația a fost resetată. Cu ce vă pot ajuta?';
    return {
      provider: 'local',
      reply,
      ...(args.includeDebug ? { debug: { intent } } : {}),
    };
  }

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
  // Guard: only fall back to history candidates when current turn yields nothing
  const searchCandidatesUsed = searchCandidatesCurrent.length > 0
    ? searchCandidatesCurrent
    : searchCandidatesFromHistory;

  // Update stored language preference (non-blocking)
  const currentLang = detectEnglish(args.text) ? 'en' : 'ro';
  setLanguage(args.sb, args.phone, currentLang).catch(() => {});
  const inventoryText = await getInventorySummary(args.sb, { intent, text: args.text, candidatesOverride: searchCandidatesUsed });

  // PR 4: list-picker for product disambiguation (feature-flagged via TWILIO_PRODUCT_LIST_SID)
  if (intent === 'product_query' && process.env.TWILIO_PRODUCT_LIST_SID) {
    const candidateNames = extractInventoryNames(inventoryText);
    if (candidateNames.length >= 2 && candidateNames.length <= 10) {
      return {
        provider: 'local',
        reply: '',
        listPicker: candidateNames,
        ...(args.includeDebug ? { debug: { intent, inventoryText, searchCandidatesCurrent, searchCandidatesFromHistory, searchCandidatesUsed, repairedOrder: false } } : {}),
      };
    }
  }

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
        ...history.map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: args.text },
      ];

      const system = buildSystemPrompt(args.name, args.phone, inventoryText);
      replyTextRaw = await args.generateLlmReply({ system, messages });

      if (args.repairOrder) {
        const recentUserMessages = history
          .filter((message) => message.role === 'user')
          .slice(-3)
          .map((message) => message.content)
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
    ...(pending ? { pending } : {}),
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
      const typedMessages: Anthropic.MessageParam[] = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

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

export function buildLocalGeneratedReply(args: {
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
      await new Promise((resolve) => setTimeout(resolve, base + jitter));
    }
  }

  throw new Error('Unreachable');
}

export async function buildOpenAiSimulatorReply(
  phone: string,
  name: string,
  text: string
): Promise<WhatsAppSimulatorResult> {
  const sb = createSupabaseClient();

  return runConversationTurn({
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
}

export async function buildAnthropicSimulatorReply(
  phone: string,
  name: string,
  text: string
): Promise<WhatsAppSimulatorResult> {
  const sb = createSupabaseClient();

  return runConversationTurn({
    sb,
    phone,
    name,
    text,
    llmProvider: 'anthropic',
    repairOrder: true,
    includeDebug: true,
    generateLlmReply: async ({ system, messages }) => {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const typedMessages: Anthropic.MessageParam[] = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

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
