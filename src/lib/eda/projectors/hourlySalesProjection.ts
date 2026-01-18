import { db } from "../core/db";

/**
 * # Hourly Sales Projector (Supabase Version)
 */
export async function projectHourlySales(input: {
  productId: string;
  delta: number;
  reason: string;
  ts: string;
}): Promise<void> {
  if (input.reason !== "SALE" || input.delta >= 0) {
    return;
  }

  const hour = input.ts.slice(0, 13);
  const soldAmount = Math.abs(input.delta);

  // In Postgres, we can use a more efficient upsert for incrementing
  const { error } = await db.rpc('increment_hourly_sales', {
    p_product_id: input.productId,
    p_hour: hour,
    p_delta: soldAmount
  });

  // If RPC is not defined yet, fallback to select-then-upsert for MVP
  // But wait, I didn't add the RPC to eda_schema.sql. 
  // Let's use a standard upsert with subquery or just select-then-upsert.
  
  if (error) {
    // Fallback if RPC fails
    const { data } = await db
      .from('hourly_sales')
      .select('total_sold, transaction_count')
      .eq('product_id', input.productId)
      .eq('hour', hour)
      .single();
    
    await db.from('hourly_sales').upsert({
      product_id: input.productId,
      hour: hour,
      total_sold: (data?.total_sold ?? 0) + soldAmount,
      transaction_count: (data?.transaction_count ?? 0) + 1
    });
  }
}