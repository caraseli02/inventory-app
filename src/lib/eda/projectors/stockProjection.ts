import { db } from "../core/db";
import type { StockLevelChangedPayload } from "../core/types";

/**
 * # Stock Projection (Derived State - Supabase Version)
 *
 * maintaining current stock level per product.
 */

export async function projectStockLevelChanged(ts: string, payload: StockLevelChangedPayload): Promise<number> {
  // Read current projected quantity
  const { data, error: selectError } = await db
    .from('stock_levels')
    .select('quantity')
    .eq('product_id', payload.productId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "no rows found"
    throw selectError;
  }

  const current = data?.quantity ?? 0;
  const next = Math.max(0, current + payload.delta);

  // Upsert the projection row.
  const { error: upsertError } = await db
    .from('stock_levels')
    .upsert({
      product_id: payload.productId,
      quantity: next,
      updated_at: ts
    });

  if (upsertError) throw upsertError;

  return next;
}

export async function getCurrentStockLevel(productId: string): Promise<number> {
  const { data, error } = await db
    .from('stock_levels')
    .select('quantity')
    .eq('product_id', productId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return data?.quantity ?? 0;
}

export async function rebuildStockLevels(): Promise<void> {
  // Clear projection
  const { error: deleteError } = await db.from('stock_levels').delete().neq('product_id', '_none_');
  if (deleteError) throw deleteError;

  // Replay events
  const { data: events, error: eventsError } = await db
    .from('events')
    .select('payload, ts')
    .eq('type', 'StockLevelChanged')
    .order('ts', { ascending: true });

  if (eventsError) throw eventsError;

  for (const event of events) {
    await projectStockLevelChanged(event.ts, event.payload as StockLevelChangedPayload);
  }
}