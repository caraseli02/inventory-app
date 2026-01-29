import { defineEventHandler, getQuery } from "h3";
import { getDailySales, getProductSalesHistory } from "../projectors/salesProjection";

/**
 * GET /api/sales
 *
 * Query daily sales projection.
 *
 * Query params:
 * - day: YYYY-MM-DD (returns sales for that day)
 * - productId: string (returns sales history for that product)
 * - If neither: returns today's sales
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const { day, productId } = query;

  // Get sales history for a specific product
  if (productId && typeof productId === "string") {
    const history = getProductSalesHistory(productId);
    return {
      productId,
      history,
      totalSold: history.reduce((sum, d) => sum + d.totalSold, 0),
      totalDelivered: history.reduce((sum, d) => sum + d.totalDelivered, 0),
    };
  }

  // Get sales for a specific day (or today)
  const targetDay = typeof day === "string" ? day : new Date().toISOString().slice(0, 10);
  const sales = getDailySales(targetDay);

  return {
    day: targetDay,
    sales,
    summary: {
      totalProductsSold: sales.length,
      totalUnitsSold: sales.reduce((sum, s) => sum + s.totalSold, 0),
      totalUnitsDelivered: sales.reduce((sum, s) => sum + s.totalDelivered, 0),
      totalTransactions: sales.reduce((sum, s) => sum + s.transactionCount, 0),
    },
  };
});
