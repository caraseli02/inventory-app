import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllProducts } from '../lib/api';
import type { Product } from '../types';

export interface LowStockProduct extends Product {
  stockDeficit: number; // How many units below min stock
}

export interface LowStockAlerts {
  /** Products with stock below minimum level */
  lowStockProducts: LowStockProduct[];
  /** Count of products needing reorder */
  lowStockCount: number;
  /** Whether there are any low stock alerts */
  hasAlerts: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh the data */
  refetch: () => void;
}

/**
 * Hook to track products that need reordering
 *
 * A product is considered "low stock" when:
 * - It has a Min Stock Level defined (> 0)
 * - Current Stock Level < Min Stock Level
 *
 * @returns Low stock alert data and utilities
 */
export const useLowStockAlerts = (): LowStockAlerts => {
  const query = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const lowStockProducts = useMemo(() => {
    if (!query.data) return [];

    return query.data
      .filter((product) => {
        const stockValue = product.fields['Current Stock Level'];
        const minValue = product.fields['Min Stock Level'];

        // Data integrity: ensure values are valid numbers
        const currentStock = typeof stockValue === 'number' && Number.isFinite(stockValue)
          ? stockValue
          : 0;
        const minStock = typeof minValue === 'number' && Number.isFinite(minValue)
          ? minValue
          : 0;

        // Only include products with defined min stock that are below threshold
        return minStock > 0 && currentStock < minStock;
      })
      .map((product) => {
        const currentStock = product.fields['Current Stock Level'] ?? 0;
        const minStock = product.fields['Min Stock Level'] ?? 0;

        return {
          ...product,
          stockDeficit: minStock - currentStock,
        };
      })
      // Sort by deficit (most urgent first)
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
