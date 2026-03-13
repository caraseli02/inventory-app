import { consumePendingOrder, storePendingOrder } from './conversation-state.js';
import { createPendingOrderFromPending } from './order-intent.js';
import type { ServerSupabaseClient } from './db.js';
import type { PendingOrder } from './types.js';

export type PendingTextDecision =
  | { kind: 'confirm'; source: 'exact' | 'interactive' }
  | { kind: 'cancel'; source: 'exact' | 'interactive' };

export type PendingOrderDecisionOutcome =
  | { status: 'confirmed'; orderNumber: string }
  | { status: 'cancelled' }
  | { status: 'already_confirmed'; orderNumber: string }
  | { status: 'already_exists_cannot_cancel'; orderNumber: string }
  | { status: 'expired' }
  | { status: 'missing' };

interface OrdersQueryableClient {
  from(table: string): unknown;
}

function normalizeDecisionText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePendingTextDecision(text: string): PendingTextDecision | null {
  const normalizedFull = normalizeDecisionText(text);
  if (/^(da|yes)$/.test(normalizedFull)) return { kind: 'confirm', source: 'exact' };
  if (/^(nu|no)$/.test(normalizedFull)) return { kind: 'cancel', source: 'exact' };

  const lastLine = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!lastLine) return null;

  const normalizedLastLine = normalizeDecisionText(lastLine);
  if (/^(da|yes)\s+confirma?$/.test(normalizedLastLine) || /^confirma$/.test(normalizedLastLine)) {
    return { kind: 'confirm', source: 'interactive' };
  }
  if (
    /^anuleaza$/.test(normalizedLastLine) ||
    /^(nu|no)\s+anuleaza$/.test(normalizedLastLine) ||
    /^cancel$/.test(normalizedLastLine)
  ) {
    return { kind: 'cancel', source: 'interactive' };
  }

  return null;
}

export async function findLatestPendingOrderNumberByPhone(
  sb: OrdersQueryableClient,
  phone: string
): Promise<string | null> {
  try {
    // Supabase's generated generic type for chained order lookups gets too deep here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('orders') as any)
      .select('order_number, status, created_at')
      .eq('customer_phone', phone)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    const orderNumber = (data?.[0] as { order_number?: string } | undefined)?.order_number;
    return orderNumber ? String(orderNumber) : null;
  } catch (err) {
    console.error('[whatsapp] failed to find latest pending order:', err);
    return null;
  }
}

export function buildPendingConfirmationText(pending: PendingOrder): string {
  const itemsList = pending.items.map((item) => `${item.qty}x ${item.name}`).join(', ');
  return `Confirmi comanda?\n${itemsList}\n*€${pending.total_price.toFixed(2)}*\nRidicare: ${pending.pickup_time || 'la preluare'}\n\nRăspunde *DA* sau *NU*.`;
}

export async function applyPendingOrderDecision(
  sb: ServerSupabaseClient,
  phone: string,
  decision: 'confirm' | 'cancel'
): Promise<PendingOrderDecisionOutcome> {
  const pendingState = await consumePendingOrder(sb, phone);

  if (pendingState.status === 'fresh') {
    if (decision === 'cancel') {
      return { status: 'cancelled' };
    }

    try {
      const orderNumber = await createPendingOrderFromPending(sb, pendingState.order);
      return { status: 'confirmed', orderNumber };
    } catch (err) {
      console.error('[whatsapp] pending order insert failed:', err);
      await storePendingOrder(sb, phone, pendingState.order);
      throw err;
    }
  }

  const existingOrderNumber = await findLatestPendingOrderNumberByPhone(sb, phone);
  if (existingOrderNumber) {
    return decision === 'confirm'
      ? { status: 'already_confirmed', orderNumber: existingOrderNumber }
      : { status: 'already_exists_cannot_cancel', orderNumber: existingOrderNumber };
  }

  return { status: pendingState.status };
}
