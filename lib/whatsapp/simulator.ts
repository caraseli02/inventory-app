import { createSupabaseClient } from './db.js';
import { processOrderIntent } from './order-intent.js';
import {
  buildAnthropicSimulatorReply,
  buildLocalGeneratedReply,
  buildOpenAiSimulatorReply,
  runConversationTurn,
} from './llm.js';
import type { ConversationMessage, WhatsAppSimulatorResult } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
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
      inventoryText: rest.system.includes('INVENTAR LIVE:\n')
        ? rest.system.split('INVENTAR LIVE:\n')[1]?.split('\n\nREGULI:')[0]?.trim() ?? 'Inventar indisponibil.'
        : 'Inventar indisponibil.',
      history: messages
        .filter((message) => message.role !== 'user' || message.content !== text)
        .map((message) => ({ role: message.role, content: message.content, timestamp: nowIso() })) as ConversationMessage[],
      customerName: name,
      customerPhone: phone,
    }),
  });
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

export async function buildSimulatorReply(phone: string, name: string, text: string): Promise<WhatsAppSimulatorResult> {
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasOpenAi && !hasAnthropic) {
    return buildLocalSimulatorTurn(phone, name, text);
  }

  if (!hasOpenAi) {
    return buildAnthropicSimulatorReply(phone, name, text);
  }

  try {
    return await buildOpenAiSimulatorReply(phone, name, text);
  } catch (err) {
    if (!hasAnthropic) throw err;
    return buildAnthropicSimulatorReply(phone, name, text);
  }
}
