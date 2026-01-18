import { db } from "../core/db";
import type { StockLevelChangedPayload } from "../core/types";

/**
 * # Sales Projection (Daily Aggregation - Supabase Version)
 */

function extractDay(ts: string): string {
  return ts.slice(0, 10);
}

export async function projectDailySales(ts: string, payload: StockLevelChangedPayload): Promise<void> {
  const day = extractDay(ts);
  const { productId, delta, reason } = payload;

  const { data, error: selectError } = await db
    .from('daily_sales')
    .select('total_sold, total_delivered, transaction_count')
    .eq('product_id', productId)
    .eq('day', day)
    .single();

  if (selectError && selectError.code !== 'PGRST116') throw selectError;

  const currentSold = data?.total_sold ?? 0;
  const currentDelivered = data?.total_delivered ?? 0;
  const currentCount = data?.transaction_count ?? 0;

  let newSold = currentSold;
  let newDelivered = currentDelivered;

  if (reason === "SALE" && delta < 0) {
    newSold = currentSold + Math.abs(delta);
  } else if (reason === "DELIVERY" && delta > 0) {
    newDelivered = currentDelivered + delta;
  }

  const { error: upsertError } = await db
    .from('daily_sales')
    .upsert({
      product_id: productId,
      day: day,
      total_sold: newSold,
      total_delivered: newDelivered,
      transaction_count: currentCount + 1
    });

  if (upsertError) throw upsertError;
}

export async function getDailySales(day: string): Promise<Array<{
  productId: string;
  totalSold: number;
  totalDelivered: number;
  transactionCount: number;
}>> {
  const { data, error } = await db
    .from('daily_sales')
    .select('product_id, total_sold, total_delivered, transaction_count')
    .eq('day', day)
    .order('total_sold', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    productId: row.product_id,
    totalSold: row.total_sold,
    totalDelivered: row.total_delivered,
    transactionCount: row.transaction_count,
  }));
}

export async function getProductSalesHistory(productId: string): Promise<Array<{
  day: string;
  totalSold: number;
  totalDelivered: number;
  transactionCount: number;
}>> {
  const { data, error } = await db
    .from('daily_sales')
    .select('day, total_sold, total_delivered, transaction_count')
    .eq('product_id', productId)
    .order('day', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    day: row.day,
    totalSold: row.total_sold,
    totalDelivered: row.total_delivered,
    transactionCount: row.transaction_count,
  }));
}

export async function rebuildDailySales(): Promise<void> {
  const { error: deleteError } = await db.from('daily_sales').delete().neq('product_id', '_none_');
  if (deleteError) throw deleteError;

  const { data: events, error: eventsError } = await db
    .from('events')
    .select('payload, ts')
    .eq('type', 'StockLevelChanged')
    .order('ts', { ascending: true });

  if (eventsError) throw eventsError;

  for (const event of events) {
    await projectDailySales(event.ts, event.payload as StockLevelChangedPayload);
  }
}