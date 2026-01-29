/* eslint-disable @typescript-eslint/no-explicit-any */
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

    // 2.5 IDEMPOTENCY CHECK: Check if we already have a pending proposal for this product
    // We don't want to spam the inbox with 100s of "Reorder" events for the same product.
    // A proposal is "Pending" if:
    // 1. There is an ActionProposed event for this Product + Type=REORDER
    // 2. There is NO HumanDecisionRecorded event for that specific ActionId

    // Fetch all events for this aggregate (which is technically the *Product* stream for the trigger, 
    // but the Action events are separate aggregates usually.
    // However, for MVP simplicity, we might iterate all events or use a specialized query.
    // Let's use `eventStore.getAllEvents()` and filter in memory since the dataset is small for this demo.
    // In production, this would be a SQL query: "SELECT * FROM projections.pending_actions WHERE product_id = ?"

    const allEvents = await eventStore.getAllEvents();

    const pendingProposal = allEvents.find(e => {
      // Is it a proposal for this product?
      if (e.type !== 'ActionProposed') return false;
      const p = e.payload as ActionProposedPayload;
      if (p.productId !== productId || p.actionType !== 'REORDER') return false;

      // Has it been decided?
      const isDecided = allEvents.some(d =>
        d.type === 'HumanDecisionRecorded' &&
        (d.payload as any).actionId === p.actionId
      );

      return !isDecided;
    });

    if (pendingProposal) {
      logger.info('Reorder Policy skipped: Pending proposal already exists', {
        productId,
        existingActionId: (pendingProposal.payload as any).actionId
      });
      return;
    }

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
