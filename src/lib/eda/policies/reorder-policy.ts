import { eventStore } from '../../event-store/store';
import { ActionProposedPayload } from '../../event-store/types';
import { supabase } from '../../supabase';
import { logger } from '../../logger';

/**
 * # Reorder Policy (Reactor)
 *
 * Listens to stock changes and proposes REORDER actions if stock is low.
 *
 * In a real backend, this would start via a DB Trigger or a Queue Worker.
 * In this client-side MVP, we call it manually after recording a stock change.
 */
export async function checkLowStockPolicy(productId: string): Promise<void> {
  logger.info('Running Reorder Policy', { productId });

  // 1. Fetch current state (Read Model)
  // We need current stock and min_stock_level
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, min_stock_level, name')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    logger.error('Reorder Policy failed: could not fetch product', { productId, error: productError });
    return;
  }

  // If no min stock set, ignore
  if (product.min_stock_level === null || product.min_stock_level === undefined) {
    return;
  }

  // Calculate current stock (we reused the logic from supabase-api essentially)
  const { data: movements, error: moveError } = await supabase
    .from('stock_movements')
    .select('quantity')
    .eq('product_id', productId);

  if (moveError) {
    logger.error('Reorder Policy failed: could not fetch movements', { productId, error: moveError });
    return;
  }

  const currentStock = (movements || []).reduce((sum, row) => sum + row.quantity, 0);

  logger.info('Reorder Policy check', {
    productId,
    currentStock,
    minStock: product.min_stock_level
  });

  // 2. Evaluate Rule
  if (currentStock <= product.min_stock_level) {
    // Check if we already proposed a reorder recently?
    // For MVP transparency, we'll just propose it. The Human Review UI can filter duplicates.

    // 3. Append Proposal Event
    const actionId = crypto.randomUUID();
    await eventStore.append({
      type: 'ActionProposed',
      aggregateType: 'Action',
      aggregateId: actionId,
      payload: {
        actionId,
        productId,
        actionType: 'REORDER',
        suggestedValueCents: 0, // Reorder doesn't imply a price change
        confidence: 1.0, // Deterministic rule
        reason: `Stock (${currentStock}) is at or below min level (${product.min_stock_level})`,
      } as ActionProposedPayload,
    });

    logger.info('Reorder Action Proposed', { productId, actionId });
  }
}
