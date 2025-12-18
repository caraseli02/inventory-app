import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addStockMovement } from '../lib/api-provider';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import type { Product, StockMovement } from '../types';

const SAFE_STOCK_THRESHOLD = 50;

type StockMutationContext = {
  previousProduct: Product | undefined;
};

/**
 * Hook for managing stock mutations (IN/OUT) with optimistic updates
 *
 * Features:
 * - Optimistic UI updates with automatic rollback on error
 * - Large quantity safety confirmation (50+ items)
 * - Toast notifications for success/error states
 * - Loading state tracking per operation type
 *
 * @param product - Product to update stock for
 * @returns Object containing mutation function, loading state, and handlers
 *
 * @example
 * const { handleStockChange, loadingAction } = useStockMutation(product);
 * handleStockChange(10, 'IN');  // Add 10 items
 */
export const useStockMutation = (product: Product) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<'IN' | 'OUT' | null>(null);

  const stockMutation = useMutation({
    mutationFn: async ({ quantity, type }: { quantity: number; type: 'IN' | 'OUT' }) => {
      logger.info('Initiating stock mutation', { productId: product.id, quantity, type });
      return addStockMovement(product.id, quantity, type);
    },
    onMutate: async ({ type, quantity }): Promise<StockMutationContext> => {
      setLoadingAction(type);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['product', product.fields.Barcode] });

      // Snapshot previous value
      const previousProduct = queryClient.getQueryData<Product>(['product', product.fields.Barcode]);

      // Optimistically update the history by adding a temporary movement
      // This automatically updates the calculated stock in ProductDetail
      queryClient.setQueryData(['history', product.id], (old: StockMovement[] | undefined) => {
        if (!old) return old;
        const tempMovement = {
          id: `temp-${Date.now()}`,
          fields: {
            Type: type,
            Quantity: type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity),
            Date: new Date().toISOString().split('T')[0],
          },
        };
        return [tempMovement, ...old];
      });

      return { previousProduct };
    },
    onSuccess: (_data, { type, quantity }) => {
      const action = type === 'IN' ? t('toast.addedTo') : t('toast.removedFrom');
      toast.success(t('toast.stockUpdateSuccess'), {
        description: t('toast.stockUpdateDescription', { quantity, action }),
      });
    },
    onError: (err, _variables, context: StockMutationContext | undefined) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id });
      toast.error(t('toast.stockUpdateError'), {
        description: err instanceof Error ? err.message : t('toast.stockUpdateErrorDescription'),
      });
      // Rollback
      if (context?.previousProduct) {
        queryClient.setQueryData(['product', product.fields.Barcode], context.previousProduct);
      }
    },
    onSettled: () => {
      setLoadingAction(null);
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['product', product.fields.Barcode] });
      // Also refetch history
      queryClient.invalidateQueries({ queryKey: ['history', product.id] });
    },
  });

  /**
   * Handles stock change with validation and safety confirmation
   * @param quantity - Quantity to add/remove (must be positive)
   * @param type - 'IN' for adding, 'OUT' for removing
   */
  const handleStockChange = (quantity: number, type: 'IN' | 'OUT') => {
    if (isNaN(quantity) || quantity <= 0) {
      logger.warn('Invalid stock quantity', { quantity });
      toast.warning(t('toast.invalidQuantity'), {
        description: t('toast.invalidQuantityDescription'),
      });
      return;
    }

    // Large quantity safety confirmation
    if (quantity > SAFE_STOCK_THRESHOLD) {
      const action = type === 'IN' ? t('product.add').toLowerCase() : t('product.remove').toLowerCase();
      const confirmed = window.confirm(
        `${t('toast.largeStockWarning')}\n\n${t('toast.largeStockConfirm', { action, quantity })}`
      );
      if (!confirmed) {
        logger.info('Large stock update cancelled by user', { quantity });
        return;
      }
    }

    stockMutation.mutate({ quantity, type });
  };

  return {
    handleStockChange,
    loadingAction,
    isLoading: stockMutation.isPending,
  };
};
