import type { ConversationMessage, PendingOrder } from './types.js';
import { createSupabaseClient, type ServerSupabaseClient } from './db.js';

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

export async function getPendingOrder(
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

    if (order) {
      await sb.from('conversation_history').update({ pending_order: null }).eq('phone_number', phone);
    }

    return order;
  } catch (err) {
    console.error('[whatsapp] failed to get pending order:', err);
    return null;
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
