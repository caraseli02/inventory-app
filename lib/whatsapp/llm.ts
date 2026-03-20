import Anthropic from '@anthropic-ai/sdk';
import { generateText, stepCountIs, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { appendHistory, getHistory, getLanguage, resetConversationHistory, setLanguage } from './conversation-state.js';
import {
  buildOverloadedReply,
  buildStoreInfoReply,
  classifyIncomingText,
  detectEnglish,
  extractSearchCandidates,
  extractSearchCandidatesFromHistory,
  handleCancellationRequest,
  looksLikeOrderRequest,
  maybeHandleMenuSelection,
  maybeHandleOrderFollowup,
  maybeRepairOrderReply,
} from './conversation.js';
import { createSupabaseClient, type ServerSupabaseClient } from './db.js';
import { getInventorySummary, searchProducts, searchProductNames } from './inventory.js';
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

function sanitizeToolQuery(raw: unknown): string {
  const query = String(raw ?? '')
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return query.length > 200 ? query.slice(0, 200) : query;
}

function parseFiniteInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.floor(num);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildListPickerHistoryText(items: string[]): string {
  const list = items.map((item, idx) => `${idx + 1}) ${item}`).join('\n');
  return `Care anume?\n${list}`;
}

function mapSearchToolResult(rows: Awaited<ReturnType<typeof searchProducts>>) {
  return {
    products: rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category ?? undefined,
      price: row.price != null ? Number(row.price.toFixed(2)) : undefined,
      currentStock: row.currentStock,
      outOfStock: row.currentStock <= 0,
    })),
  };
}

const SEARCH_PRODUCTS_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Product name or partial match (e.g. "milk")' },
    limit: { type: 'integer', description: 'Max results (default 10, max 25)' },
  },
  required: ['query'],
} as const;

async function generateAnthropicReplyWithTools(args: {
  anthropic: Anthropic;
  system: string;
  messages: LlmMessage[];
  sb: ServerSupabaseClient;
  userTextForOverload: string;
}): Promise<string> {
  // Keep tool typing loose here — Anthropic SDK tool types have shifted between versions.
  const toolDefs = [{
    name: 'search_products',
    description: 'Search live inventory by product name or partial match. Returns name, price (EUR), and current stock.',
    input_schema: SEARCH_PRODUCTS_INPUT_SCHEMA,
  }] as unknown as NonNullable<Anthropic.MessageCreateParams['tools']>;

  const thread: Anthropic.MessageParam[] = args.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  for (let step = 0; step < 4; step += 1) {
    try {
      const response = await createAnthropicMessageWithRetry(args.anthropic, {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: args.system,
        messages: thread,
        tools: toolDefs,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolUses = (response.content.filter((block: any) => block.type === 'tool_use') as any[]) ?? [];
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      if (!toolUses.length) return text;

      thread.push({ role: 'assistant', content: response.content });

      for (const use of toolUses) {
        const input = (use.input ?? {}) as { query?: unknown; limit?: unknown };
        if (use.name !== 'search_products') {
          thread.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: use.id,
              content: JSON.stringify({ error: 'Unsupported tool' }),
              is_error: true,
            }],
          });
          continue;
        }

        const query = sanitizeToolQuery(input.query);
        const parsedLimit = parseFiniteInt(input.limit);
        const limit = parsedLimit == null ? undefined : clamp(parsedLimit, 1, 25);

        if (!query) {
          thread.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: use.id,
              content: JSON.stringify({ products: [] }),
            }],
          });
          continue;
        }

        try {
          const rows = await searchProducts(args.sb, { query, limit });
          thread.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: use.id,
              content: JSON.stringify(mapSearchToolResult(rows)),
            }],
          });
        } catch (err) {
          console.error('[whatsapp] search_products tool failed:', err);
          thread.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: use.id,
              content: JSON.stringify({ error: 'Inventar indisponibil.' }),
              is_error: true,
            }],
          });
        }
      }
    } catch (err) {
      if (isAnthropicOverloaded(err)) return buildOverloadedReply(args.userTextForOverload);
      throw err;
    }
  }

  return '';
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
  const shouldIncludeInventory = args.llmProvider === 'local' || intent === 'browse_inventory';
  const inventoryText = shouldIncludeInventory
    ? await getInventorySummary(args.sb, { intent, text: args.text, candidatesOverride: searchCandidatesUsed })
    : '';

  // Text-only numbered disambiguation when the name lookup yields a small candidate set.
  if (intent === 'product_query') {
    if (searchCandidatesUsed.length > 0) {
      const candidateNames = await searchProductNames(args.sb, { candidates: searchCandidatesUsed, limit: 10 });
      if (candidateNames.length >= 2 && candidateNames.length <= 9) {
      console.log('[whatsapp] returning list-picker result with', candidateNames.length, 'items');
      try {
        await appendHistory(args.sb, args.phone, history, [
          { role: 'user', content: args.text, timestamp: nowIso() },
          { role: 'assistant', content: buildListPickerHistoryText(candidateNames), timestamp: nowIso() },
        ]);
      } catch (err) {
        console.error('[whatsapp] history append failed:', err);
      }
      return {
        provider: 'local',
        reply: '',
        listPicker: candidateNames,
        ...(args.includeDebug ? { debug: { intent, inventoryText, searchCandidatesCurrent, searchCandidatesFromHistory, searchCandidatesUsed, repairedOrder: false } } : {}),
      };
    }
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

      const system = buildSystemPrompt(
        args.name,
        args.phone,
        shouldIncludeInventory ? inventoryText : '',
      );
      replyTextRaw = await args.generateLlmReply({ system, messages });

      if (args.repairOrder) {
        if (/ORDER:\s*\{[\s\S]*\}/i.test(replyTextRaw)) {
          // Already has ORDER payload; do not waste a DB hit trying to repair.
          const orderResult = await processOrderIntent(args.sb, replyTextRaw);
          replyTextRaw = orderResult.reply;
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
                repairedOrder: false,
              },
            } : {}),
          };
        }

        const recentUserMessages = history
          .filter((message) => message.role === 'user')
          .slice(-3)
          .map((message) => message.content)
          .join(' ');
        const hasTime = /\b([01]?\d|2[0-3])[.:][0-5]\d\b/.test(args.text);
        const hasQty = /\b([1-9]\d?)\b/.test(args.text);
        const shouldAttemptRepair = hasTime && hasQty && looksLikeOrderRequest(`${recentUserMessages} ${args.text}`);
        const repairInventoryText = inventoryText || (shouldAttemptRepair
          ? await getInventorySummary(args.sb, {
            intent,
            text: args.text,
            candidatesOverride: searchCandidatesUsed,
          })
          : '');
        const repaired = maybeRepairOrderReply({
          replyText: replyTextRaw,
          userText: args.text,
          historyContext: recentUserMessages,
          inventoryText: repairInventoryText,
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
      return generateAnthropicReplyWithTools({
        anthropic,
        system,
        messages,
        sb,
        userTextForOverload: text,
      });
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
	        tools: {
	          search_products: tool({
	            description: 'Search live inventory by product name or partial match. Returns name, price (EUR), and current stock.',
	            inputSchema: z.object({
	              query: z.string().min(1).max(200),
	              limit: z.number().int().min(1).max(25).optional(),
	            }),
	            execute: async (input) => {
	              const query = sanitizeToolQuery(input.query);
	              const parsedLimit = parseFiniteInt(input.limit);
	              const limit = parsedLimit == null ? undefined : clamp(parsedLimit, 1, 25);
	              return mapSearchToolResult(await searchProducts(sb, { query, limit }));
	            },
	          }),
	        },
	        stopWhen: stepCountIs(4),
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
      return generateAnthropicReplyWithTools({
        anthropic,
        system,
        messages,
        sb,
        userTextForOverload: text,
      });
    },
  });
}
