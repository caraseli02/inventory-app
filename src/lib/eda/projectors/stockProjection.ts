import { db } from "../core/db.js";
import type { StockLevelChangedPayload } from "../core/types.js";

/**
 * # Stock Projection (Derived State)
 *
 * This file maintains the **current stock level per product** as a projection.
 *
 * Why this exists:
 * - The event log (`events`) is the source of truth, but querying "current stock"
 *   by replaying every event on every request is too slow.
 * - A projection is a rebuildable cache/materialized view. If it is ever wrong,
 *   we can delete it and rebuild it from the immutable event log.
 *
 * What this projection stores:
 * - Table: `stock_levels(product_id, quantity, updated_at)`
 * - `quantity` is derived from the cumulative sum of `StockLevelChanged.delta`.
 * - `updated_at` tracks when the projection was last updated (ISO timestamp).
 *
 * Determinism / replayability:
 * - Given the same ordered list of `StockLevelChanged` events, the resulting
 *   `stock_levels` rows are the same.
 * - This is why rebuild reads from the event log ordered by `ts ASC`.
 *
 * Important constraint:
 * - Only events should be considered “facts”.
 * - The projection is allowed to be deleted and rebuilt; it must not contain
 *   information that cannot be recovered from events.
 */

/**
 * Apply one `StockLevelChanged` event to the `stock_levels` projection.
 *
 * This is called during normal operation (right after appending the event),
 * and also during replay (rebuild) when processing historical events.
 *
 * @param ts ISO timestamp of the event (used as projection updated_at)
 * @param payload The event payload containing `productId` and `delta`
 * @returns The new projected quantity after applying the delta
 */
export function projectStockLevelChanged(ts: string, payload: StockLevelChangedPayload): number {
  // Read current projected quantity (projection is the fast “current state” view).
  const existing = db
    .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
    .get(payload.productId) as { quantity: number } | undefined;

  const current = existing?.quantity ?? 0;

  // Stock is clamped to >= 0 for this MVP.
  // (The event log still stores the raw delta; clamping is a projection rule.)
  const next = Math.max(0, current + payload.delta);

  // Upsert the projection row.
  db.prepare(`
    INSERT INTO stock_levels (product_id, quantity, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(product_id) DO UPDATE SET
      quantity = excluded.quantity,
      updated_at = excluded.updated_at
  `).run(payload.productId, next, ts);

  return next;
}

/**
 * Convenience read for "current stock level".
 *
 * Note:
 * - This reads the projection, not the event log.
 * - If you need full history, query `events` instead.
 */
export function getCurrentStockLevel(productId: string): number {
  const row = db
    .prepare(`SELECT quantity FROM stock_levels WHERE product_id = ?`)
    .get(productId) as { quantity: number } | undefined;

  return row?.quantity ?? 0;
}

/**
 * Rebuild the entire `stock_levels` projection from the immutable event log.
 *
 * This is the “proof” that the projection is derived state:
 * - Delete all projection rows
 * - Replay all `StockLevelChanged` events in deterministic order
 *
 * When to use:
 * - After changing projection logic
 * - If you suspect projection drift/corruption
 * - As part of a “replay from scratch” workflow
 */
export function rebuildStockLevels(): void {
  // Delete projection rows (never delete events here).
  db.prepare(`DELETE FROM stock_levels`).run();

  // Replay only the events we need for this projection.
  const rows = db
    .prepare(`
      SELECT payload, ts
      FROM events
      WHERE type = 'StockLevelChanged'
      ORDER BY ts ASC
    `)
    .all() as Array<{ payload: string; ts: string }>;

  // Apply each historical event in order to reconstruct the same derived state.
  for (const row of rows) {
    const payload = JSON.parse(row.payload) as StockLevelChangedPayload;
    projectStockLevelChanged(row.ts, payload);
  }
}
