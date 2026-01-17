import { db } from "~~/server/core/db";

/**
 * GET /api/hourly-sales?productId=apple&date=2025-01-15
 *
 * Returns hourly sales breakdown for a product on a specific date.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const productId = query.productId as string;
  const date = query.date as string; // Format: "2025-01-15"

  if (!productId || !date) {
    throw createError({
      statusCode: 400,
      message: "Missing required query params: productId, date",
    });
  }

  // Query all hours for this product on this date
  const rows = db.prepare(`
    SELECT hour, total_sold, transaction_count
    FROM hourly_sales
    WHERE product_id = ? AND hour LIKE ?
    ORDER BY hour ASC
  `).all(productId, `${date}%`) as Array<{
    hour: string;
    total_sold: number;
    transaction_count: number;
  }>;

  return {
    productId,
    date,
    hours: rows.map((row) => ({
      hour: row.hour,
      totalSold: row.total_sold,
      transactionCount: row.transaction_count,
    })),
  };
});
