import { createSupabaseClient } from './db.js';
import { storePendingOrder } from './conversation-state.js';
import { processOrderIntent } from './order-intent.js';
import {
  buildAnthropicSimulatorReply,
  buildLocalGeneratedReply,
  buildOpenAiSimulatorReply,
  runConversationTurn,
} from './llm.js';
import {
  applyPendingOrderDecision,
  buildPendingConfirmationText,
  parsePendingTextDecision,
} from './pending-order.js';
import type { ConversationMessage, WhatsAppSimulatorResult } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

function buildTextListPicker(items: string[]): string {
  const list = items.map((item, idx) => `${idx + 1}) ${item}`).join('\n');
  return `Care anume?\n${list}`;
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

async function finalizeSimulatorResult(
  phone: string,
  result: WhatsAppSimulatorResult
): Promise<WhatsAppSimulatorResult> {
  if (result.listPicker && (!result.reply || result.reply.trim() === '')) {
    return {
      ...result,
      reply: buildTextListPicker(result.listPicker),
      transaction: result.transaction ?? { status: 'reply' },
    };
  }

  if (!result.pending) {
    return {
      ...result,
      transaction: result.transaction ?? { status: 'reply' },
    };
  }

  const sb = createSupabaseClient();
  await storePendingOrder(sb, phone, result.pending);
  return {
    ...result,
    reply: buildPendingConfirmationText(result.pending),
    transaction: { status: 'pending_confirmation' },
  };
}

export async function buildLocalSimulationReply(phone: string, name: string, text: string): Promise<string> {
  const decision = parsePendingTextDecision(text);
  if (decision) {
    const sb = createSupabaseClient();
    const outcome = await applyPendingOrderDecision(sb, phone, decision.kind);
    if (outcome.status === 'confirmed') {
      return `✅ Cererea ${outcome.orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`;
    }
    if (outcome.status === 'cancelled') {
      return '❌ Comanda a fost anulată.';
    }
    if (outcome.status === 'already_confirmed') {
      return `✅ Cererea ${outcome.orderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`;
    }
    if (outcome.status === 'already_exists_cannot_cancel') {
      return `ℹ️ Cererea ${outcome.orderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`;
    }
    if (decision.source === 'interactive' || outcome.status === 'expired') {
      return '⚠️ Comanda a expirat. Te rog trimite din nou.';
    }
  }

  const orderReply = toSimulationOrderReply(phone, name, text);
  if (!orderReply) {
    const result = await buildLocalSimulatorTurn(phone, name, text);
    return (await finalizeSimulatorResult(phone, result)).reply;
  }

  const sb = createSupabaseClient();
  const result = await processOrderIntent(sb, orderReply);
  return (await finalizeSimulatorResult(phone, {
    provider: 'local',
    ...result,
  })).reply;
}

export async function buildSimulatorReply(phone: string, name: string, text: string): Promise<WhatsAppSimulatorResult> {
  const decision = parsePendingTextDecision(text);
  if (decision) {
    const sb = createSupabaseClient();
    const outcome = await applyPendingOrderDecision(sb, phone, decision.kind);
    if (outcome.status === 'confirmed') {
      return {
        provider: 'local',
        reply: `✅ Cererea ${outcome.orderNumber} a fost înregistrată și așteaptă confirmarea magazinului.`,
        transaction: { status: 'confirmed', orderNumber: outcome.orderNumber },
      };
    }
    if (outcome.status === 'cancelled') {
      return {
        provider: 'local',
        reply: '❌ Comanda a fost anulată.',
        transaction: { status: 'cancelled' },
      };
    }
    if (outcome.status === 'already_confirmed') {
      return {
        provider: 'local',
        reply: `✅ Cererea ${outcome.orderNumber} a fost deja înregistrată și așteaptă confirmarea magazinului.`,
        transaction: { status: 'already_confirmed', orderNumber: outcome.orderNumber },
      };
    }
    if (outcome.status === 'already_exists_cannot_cancel') {
      return {
        provider: 'local',
        reply: `ℹ️ Cererea ${outcome.orderNumber} este deja înregistrată și nu mai poate fi anulată din acest mesaj.`,
        transaction: { status: 'already_exists_cannot_cancel', orderNumber: outcome.orderNumber },
      };
    }
    if (decision.source === 'interactive' || outcome.status === 'expired') {
      return {
        provider: 'local',
        reply: '⚠️ Comanda a expirat. Te rog trimite din nou.',
        transaction: { status: 'expired' },
      };
    }
  }

  const orderReply = toSimulationOrderReply(phone, name, text);
  if (orderReply) {
    const sb = createSupabaseClient();
    const result = await processOrderIntent(sb, orderReply);
    return finalizeSimulatorResult(phone, {
      provider: 'local',
      ...result,
    });
  }

  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasOpenAi && !hasAnthropic) {
    return finalizeSimulatorResult(phone, await buildLocalSimulatorTurn(phone, name, text));
  }

  if (!hasOpenAi) {
    return finalizeSimulatorResult(phone, await buildAnthropicSimulatorReply(phone, name, text));
  }

  try {
    return await finalizeSimulatorResult(phone, await buildOpenAiSimulatorReply(phone, name, text));
  } catch (err) {
    if (!hasAnthropic) throw err;
    return finalizeSimulatorResult(phone, await buildAnthropicSimulatorReply(phone, name, text));
  }
}
