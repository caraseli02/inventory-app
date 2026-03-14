import type { ConversationMessage, PendingOrder } from './types.js';
import { createSupabaseClient, type ServerSupabaseClient } from './db.js';

export type PendingOrderState =
  | { status: 'missing'; order: null }
  | { status: 'expired'; order: null }
  | { status: 'fresh'; order: PendingOrder };

function nowIso(): string {
  return new Date().toISOString();
}

function getPendingOrderTtlMs(): number {
  const ttlMinutes = Number(process.env.WHATSAPP_PENDING_ORDER_TTL_MINUTES ?? '120');
  const effectiveTtlMinutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 120;
  return effectiveTtlMinutes * 60 * 1000;
}

function isPendingOrderExpired(order: PendingOrder | null): boolean {
  if (!order?.pending_order_created_at) return false;
  const createdAt = new Date(order.pending_order_created_at).getTime();
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false;
  return Date.now() - createdAt > getPendingOrderTtlMs();
}

function toPendingOrderState(order: PendingOrder | null): PendingOrderState {
  if (!order) return { status: 'missing', order: null };
  if (isPendingOrderExpired(order)) return { status: 'expired', order: null };
  return { status: 'fresh', order };
}

export async function clearPendingOrder(
  sb: ServerSupabaseClient,
  phone: string
): Promise<void> {
  try {
    await sb.from('conversation_history').update({ pending_order: null }).eq('phone_number', phone);
  } catch (err) {
    console.error('[whatsapp] failed to clear pending order:', err);
  }
}

export async function resetConversationHistory(phone: string): Promise<void> {
  const sb = createSupabaseClient();
  await sb.from('conversation_history').delete().eq('phone_number', phone);
}

export async function hasConversationHistory(
  sb: ServerSupabaseClient,
  phone: string
): Promise<boolean> {
  try {
    const { data } = await sb
      .from('conversation_history')
      .select('messages')
      .eq('phone_number', phone)
      .maybeSingle();

    return ((data?.messages as unknown[])?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function storePendingOrder(
  sb: ServerSupabaseClient,
  phone: string,
  order: PendingOrder
): Promise<void> {
  try {
    const pendingOrder: PendingOrder = {
      ...order,
      pending_order_created_at: order.pending_order_created_at ?? nowIso(),
    };
    await sb.from('conversation_history').upsert(
      {
        phone_number: phone,
        pending_order: pendingOrder as unknown,
      },
      { onConflict: 'phone_number' }
    );
  } catch (err) {
    console.error('[whatsapp] failed to store pending order:', err);
  }
}

// Pending orders are transactional state. Callers should peek first and only
// clear after an explicit confirm/cancel transition.
export async function getPendingOrderState(
  sb: ServerSupabaseClient,
  phone: string
): Promise<PendingOrderState> {
  try {
    const { data } = await sb
      .from('conversation_history')
      .select('pending_order')
      .eq('phone_number', phone)
      .maybeSingle();

    const order = (data?.pending_order ?? null) as PendingOrder | null;
    const state = toPendingOrderState(order);
    if (state.status === 'expired') {
      await clearPendingOrder(sb, phone);
    }

    return state;
  } catch (err) {
    console.error('[whatsapp] failed to peek pending order:', err);
    return { status: 'missing', order: null };
  }
}

export async function peekPendingOrder(
  sb: ServerSupabaseClient,
  phone: string
): Promise<PendingOrder | null> {
  const state = await getPendingOrderState(sb, phone);
  return state.status === 'fresh' ? state.order : null;
}

export async function consumePendingOrder(
  sb: ServerSupabaseClient,
  phone: string
): Promise<PendingOrderState> {
  try {
    // Prefer the atomic RPC path (prevents double-confirm race condition).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcResult = await (sb as any).rpc('consume_pending_order', { p_phone: phone });
    const rpcError = rpcResult?.error;
    const rpcData = rpcResult?.data;

    if (!rpcError) {
      if (rpcData === null || rpcData === undefined) return { status: 'missing', order: null };
      const order = rpcData as PendingOrder;
      return toPendingOrderState(order);
    }

    // RPC not available (e.g. local dev without migration) — fall back to non-atomic path.
    console.warn('[whatsapp] consume_pending_order RPC unavailable, using fallback:', rpcError);
  } catch {
    // fall through to non-atomic fallback
  }

  try {
    // Non-atomic fallback: read then clear (two round trips).
    const { data: peekData } = await sb
      .from('conversation_history')
      .select('pending_order')
      .eq('phone_number', phone)
      .maybeSingle();

    const order = (peekData?.pending_order ?? null) as PendingOrder | null;
    const state = toPendingOrderState(order);

    if (order !== null) {
      await sb.from('conversation_history').update({ pending_order: null }).eq('phone_number', phone);
    }

    return state;
  } catch (err) {
    console.error('[whatsapp] failed to consume pending order:', err);
    return { status: 'missing', order: null };
  }
}

export async function getHistory(
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
  const isExpired = updatedAt > 0 && Date.now() - updatedAt > effectiveTtlDays * 24 * 60 * 60 * 1000;
  if (isExpired) return [];

  return ((data?.messages ?? []) as ConversationMessage[]).slice(-20);
}

export async function getLanguage(sb: ServerSupabaseClient, phone: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('conversation_history')
      .select('language')
      .eq('phone_number', phone)
      .maybeSingle();
    return (data?.language as string | null | undefined) ?? 'ro';
  } catch {
    return 'ro';
  }
}

export async function setLanguage(sb: ServerSupabaseClient, phone: string, lang: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from('conversation_history')
      .upsert({ phone_number: phone, language: lang }, { onConflict: 'phone_number' });
  } catch (err) {
    console.warn('[whatsapp] failed to set language preference:', err);
  }
}

export async function storePendingProductSelection(
  sb: ServerSupabaseClient,
  phone: string,
  selection: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from('conversation_history')
      .upsert({ phone_number: phone, pending_selection: selection }, { onConflict: 'phone_number' });
  } catch (err) {
    console.warn('[whatsapp] failed to store pending selection:', err);
  }
}

export async function getPendingProductSelection(
  sb: ServerSupabaseClient,
  phone: string
): Promise<Record<string, unknown> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('conversation_history')
      .select('pending_selection')
      .eq('phone_number', phone)
      .maybeSingle();
    return (data?.pending_selection as Record<string, unknown> | null | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function appendHistory(
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
    // fall through to upsert fallback
  }

  await sb.from('conversation_history').upsert(
    { phone_number: phone, messages: [...history, ...payload].slice(-20) },
    { onConflict: 'phone_number' }
  );
}
