import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllProducts } from '../lib/api-provider';
import { logger } from '../lib/logger';
import type { Product } from '../types';

/** Cache duration for low stock alerts data (5 minutes) */
const ALERT_CACHE_DURATION_MS = 1000 * 60 * 5;

/**
 * Represents a product that is below its minimum stock level.
 *
 * @invariant stockDeficit > 0 (guaranteed by createLowStockProduct factory)
 * @invariant stockDeficit = Min Stock Level - Current Stock Level
 */
export interface LowStockProduct extends Product {
  /**
   * Units below minimum stock level (always positive).
   * Represents how many units need to be ordered to reach the minimum threshold.
   */
  stockDeficit: number;
}

/**
 * Return type for useLowStockAlerts hook.
 *
 * @invariant lowStockCount === lowStockProducts.length
 * @invariant hasAlerts === (lowStockProducts.length > 0)
 */
export interface LowStockAlerts {
  /** Products with Current Stock Level below Min Stock Level, sorted by deficit (highest first) */
  lowStockProducts: LowStockProduct[];
  /** Count of products needing reorder (equals lowStockProducts.length) */
  lowStockCount: number;
  /** Whether there are any low stock alerts (true when lowStockProducts.length > 0) */
  hasAlerts: boolean;
  /** Loading state from the underlying query */
  isLoading: boolean;
  /** Error state - check this to handle fetch failures gracefully */
  error: Error | null;
  /** Refresh the data manually */
  refetch: () => void;
}

/**
 * Validates stock values and returns normalized numbers.
 * Logs warnings for invalid data that could indicate Airtable schema issues.
 */
function getValidatedStockValues(
  product: Product
): { currentStock: number; minStock: number; hasInvalidData: boolean } {
  const stockValue = product.fields['Current Stock Level'];
  const minValue = product.fields['Min Stock Level'];
  let hasInvalidData = false;

  // Validate current stock
  let currentStock = 0;
  if (typeof stockValue === 'number' && Number.isFinite(stockValue)) {
    currentStock = stockValue;
  } else if (stockValue !== undefined && stockValue !== null) {
    // Value exists but is invalid - log warning
    logger.warn('Invalid Current Stock Level value, defaulting to 0', {
      productId: product.id,
      productName: product.fields.Name,
      actualValue: stockValue,
      actualType: typeof stockValue,
      expectedType: 'number',
    });
    hasInvalidData = true;
  }

  // Validate min stock
  let minStock = 0;
  if (typeof minValue === 'number' && Number.isFinite(minValue)) {
    minStock = minValue;
  } else if (minValue !== undefined && minValue !== null) {
    // Value exists but is invalid - log warning
    logger.warn('Invalid Min Stock Level value, defaulting to 0', {
      productId: product.id,
      productName: product.fields.Name,
      actualValue: minValue,
      actualType: typeof minValue,
      expectedType: 'number',
    });
    hasInvalidData = true;
  }

  return { currentStock, minStock, hasInvalidData };
}

/**
 * Factory function to create a LowStockProduct with validated stockDeficit.
 *
 * Returns null if the product doesn't qualify as low stock:
 * - No Min Stock Level defined (or <= 0)
 * - Current Stock Level >= Min Stock Level
 *
 * This ensures stockDeficit is always positive when a LowStockProduct exists.
 */
function createLowStockProduct(product: Product): LowStockProduct | null {
  const { currentStock, minStock } = getValidatedStockValues(product);

  // Products without a defined minimum stock threshold don't qualify for alerts.
  // This is intentional - admin may not want alerts for certain products.
  if (minStock <= 0) {
    return null;
  }

  // Product is not low stock if current >= minimum
  if (currentStock >= minStock) {
    return null;
  }

  // Create the LowStockProduct with validated deficit
  const stockDeficit = minStock - currentStock;

  return {
    ...product,
    stockDeficit,
  };
}

/**
 * Hook to track products that need reordering.
 *
 * A product is considered "low stock" when:
 * - It has a Min Stock Level defined (> 0) - products without a threshold are
 *   intentionally excluded (likely configured this way by admin)
 * - Current Stock Level < Min Stock Level (strictly below, not equal)
 *
 * Results are sorted by deficit (highest first) so store managers can prioritize
 * reordering items most urgently needed for restocking.
 *
 * Data is cached for 5 minutes and automatically refetches when window regains focus.
 *
 * @returns Low stock alert data including loading/error states - consumers SHOULD
 *          check isLoading and error to handle all states gracefully.
 *
 * @example
 * const { lowStockProducts, hasAlerts, error, isLoading, refetch } = useLowStockAlerts();
 *
 * if (error) {
 *   return <ErrorMessage>Could not load stock alerts</ErrorMessage>;
 * }
 *
 * if (isLoading) {
 *   return <Spinner />;
 * }
 *
 * if (hasAlerts) {
 *   showNotification(`${lowStockProducts.length} items need reordering`);
 * }
 */
export const useLowStockAlerts = (): LowStockAlerts => {
  const query = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: ALERT_CACHE_DURATION_MS,
    refetchOnWindowFocus: true,
  });

  const lowStockProducts = useMemo(() => {
    if (!query.data) return [];

    return query.data
      // Use factory function to filter and create LowStockProducts
      .map(createLowStockProduct)
      // Filter out null results (products that don't qualify)
      .filter((product): product is LowStockProduct => product !== null)
      // Sort by deficit descending - highest deficit (most urgent) first
      // This prioritization helps store managers focus on the most critical reorders
      .sort((a, b) => b.stockDeficit - a.stockDeficit);
  }, [query.data]);

  return {
    lowStockProducts,
    lowStockCount: lowStockProducts.length,
    hasAlerts: lowStockProducts.length > 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
