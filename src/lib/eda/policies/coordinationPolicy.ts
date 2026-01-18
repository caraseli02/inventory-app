import { db } from "../core/db";

/**
 * # Coordination Policy (Gate #3 - Supabase Version)
 */

function dayKey(ts: string): string {
  return ts.slice(0, 10);
}

export async function canChangePriceToday(input: { productId: string; ts: string }): Promise<boolean> {
  const day = dayKey(input.ts);
  const { data, error } = await db
    .from('daily_price_changes')
    .select('product_id')
    .eq('product_id', input.productId)
    .eq('day', day)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  
  return !data;
}

export async function markPriceChangedToday(input: { productId: string; ts: string }): Promise<void> {
  const day = dayKey(input.ts);
  const { error } = await db
    .from('daily_price_changes')
    .upsert({
      product_id: input.productId,
      day: day
    });

  if (error) throw error;
}