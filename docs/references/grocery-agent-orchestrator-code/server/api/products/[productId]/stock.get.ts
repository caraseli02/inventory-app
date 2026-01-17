import { getDatabase } from "~~/server/core/db";

/**
 * # Product Stock Query (HTTP)
 *
 * Read-only endpoint to fetch current stock for a single product.
 * This reads from the `stock_levels` projection (derived state).
 *
 * If you need the full history, query the event log instead.
 */
export default defineEventHandler((event) => {
  const productId = getRouterParam(event, "productId");

  // Validate route param.
  if (!productId) {
    throw createError({
      statusCode: 400,
      message: "Product ID is required",
    });
  }

  const db = getDatabase();
  // Read the projection row for this product.
  const stock = db
    .prepare(`
      SELECT
        product_id AS productId,
        quantity,
        updated_at AS updatedAt
      FROM stock_levels
      WHERE product_id = ?
    `)
    .get(productId) as { productId: string; quantity: number; updatedAt: string } | undefined;

  if (!stock) {
    throw createError({
      statusCode: 404,
      message: `Stock data not found for product ${productId}`,
    });
  }

  return stock;
});
