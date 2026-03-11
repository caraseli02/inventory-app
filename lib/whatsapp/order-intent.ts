import type { PendingOrder } from './types.js';
import { normalizePickupTime } from './conversation.js';
import { resolveOrderItems } from './inventory.js';

interface OrdersInsertChain {
  select(columns: string): {
    single(): Promise<{ data: unknown; error: unknown }>;
  };
}

interface OrdersTableClient {
  insert(values: Record<string, unknown>): OrdersInsertChain;
}

interface OrdersQueryableClient {
  from(table: string): unknown;
}

interface InventoryQueryableClient {
  from(table: string): unknown;
}

type OrderIntentClient = OrdersQueryableClient & InventoryQueryableClient;

export interface ProcessOrderResult {
  reply: string;
  pending?: PendingOrder;
}

export function extractOrderJson(text: string): { json: string; startIdx: number } | null {
  const orderIdx = text.search(/ORDER:/i);
  if (orderIdx === -1) return null;
  const braceStart = text.indexOf('{', orderIdx);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let index = braceStart; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return { json: text.slice(braceStart, index + 1), startIdx: orderIdx };
    }
  }

  return null;
}

export async function createPendingOrderFromPending(
  sb: OrdersQueryableClient,
  pending: PendingOrder,
): Promise<string> {
  const ordersTable = sb.from('orders') as OrdersTableClient;
  const { data: order, error } = await ordersTable
    .insert({
      customer_name: pending.customer_name,
      customer_phone: pending.customer_phone,
      items: pending.items,
      total_price: pending.total_price,
      pickup_time: pending.pickup_time,
      status: 'pending',
    })
    .select('order_number')
    .single();

  if (error) throw error;
  return (order as { order_number: string } | null)?.order_number ?? '—';
}

export async function processOrderIntent(
  sb: OrderIntentClient,
  replyText: string,
): Promise<ProcessOrderResult> {
  const extracted = extractOrderJson(replyText);
  if (!extracted) return { reply: replyText };

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

    const pending: PendingOrder = {
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      items: resolved.items,
      total_price: resolved.totalPrice,
      pickup_time: normalizedPickupTime,
    };

    return {
      reply: stripOrder(
        replyText,
        `${resolved.items.map((item) => `${item.qty}x ${item.name}`).join('\n')}
€${resolved.totalPrice.toFixed(2)}
Ridicare: ${normalizedPickupTime || 'la preluare'}`
      ),
      pending,
    };
  } catch (error) {
    console.error('[whatsapp] order creation failed:', error);
    const message = error instanceof Error ? error.message : '';

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
