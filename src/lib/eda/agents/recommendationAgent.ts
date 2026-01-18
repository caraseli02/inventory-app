import { db } from "../core/db";
import type { ActionProposedPayload, StockLevelChangedPayload } from "../core/types";

/**
 * # Recommendation Agent (Proposal-Only - Supabase Version)
 */

const DEFAULT_REORDER_THRESHOLD = 10;

async function readReorderThreshold(productId: string): Promise<number> {
  const { data, error } = await db
    .from('events')
    .select('payload')
    .eq('type', 'StockLevelChanged')
    .eq('aggregate_id', productId)
    .order('ts', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return DEFAULT_REORDER_THRESHOLD;

  try {
    const payload = data.payload as Partial<StockLevelChangedPayload>;
    const threshold = payload.threshold;
    return (typeof threshold === 'number' && threshold > 0) ? Math.trunc(threshold) : DEFAULT_REORDER_THRESHOLD;
  } catch {
    return DEFAULT_REORDER_THRESHOLD;
  }
}

async function readCurrentStock(productId: string): Promise<number> {
  const { data, error } = await db
    .from('stock_levels')
    .select('quantity')
    .eq('product_id', productId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.quantity ?? 0;
}

async function readCurrentPriceCents(productId: string): Promise<number> {

  const { data, error } = await db

    .from('product_prices')

    .select('price_cents')

    .eq('product_id', productId)

    .single();



  if (error && error.code !== 'PGRST116') throw error;

  return data?.price_cents ?? 500;

}



export async function proposeActionsForProduct(input: {

  ts: string;

  productId: string;

  experimentId: string;

  variant: string;

}): Promise<ActionProposedPayload[]> {

  const currentStock = await readCurrentStock(input.productId);

  const threshold = await readReorderThreshold(input.productId);



  const proposals: ActionProposedPayload[] = [];



  if (currentStock <= threshold) {

    const isCritical = currentStock <= threshold * 0.5;

    proposals.push({

      actionId: crypto.randomUUID(),

      productId: input.productId,

      actionType: "REORDER",

      suggestedValueCents: 0,

      confidence: isCritical ? 0.92 : 0.68,

      reason: isCritical

        ? `Stock critically low (${currentStock}/${threshold}). Recommend reorder now.`

        : `Stock below threshold (${currentStock}/${threshold}). Consider reorder.`,

      experimentId: input.experimentId,

      variant: input.variant,

    });



    return proposals;

  }



  if (currentStock >= threshold * 3) {

    const currentPriceCents = await readCurrentPriceCents(input.productId);

    const deltaCents = Math.min(200, Math.max(25, Math.round(currentPriceCents * 0.1)));



    proposals.push({

      actionId: crypto.randomUUID(),

      productId: input.productId,

      actionType: "PRICE_DECREASE",

      suggestedValueCents: deltaCents,

      confidence: 0.74,

      reason: `Overstocked (${currentStock} units vs threshold ${threshold}). Suggest price decrease by ${deltaCents} cents.`,

      experimentId: input.experimentId,

      variant: input.variant,

    });

  }



  return proposals;

}
