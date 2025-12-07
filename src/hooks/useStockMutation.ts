import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addStockMovement } from '../lib/api';
import { useToast } from './useToast';
import { logger } from '../lib/logger';
import type { Product } from '../types';

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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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

      // Optimistically update
      queryClient.setQueryData(['product', product.fields.Barcode], (old: Product | undefined) => {
        if (!old) return old;
        const change = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
        return {
          ...old,
          fields: {
            ...old.fields,
            'Current Stock': (old.fields?.['Current Stock'] ?? 0) + change,
          },
        };
      });

      return { previousProduct };
    },
    onSuccess: (_data, { type, quantity }) => {
      const action = type === 'IN' ? 'added to' : 'removed from';
      showToast(
        'success',
        'Stock updated',
        `${quantity} item${quantity > 1 ? 's' : ''} ${action} inventory`,
        3000
      );
    },
    onError: (err, _variables, context: StockMutationContext | undefined) => {
      logger.error('Stock mutation failed', { error: err, productId: product.id });
      showToast(
        'error',
        'Failed to update stock',
        err instanceof Error ? err.message : 'Unknown error occurred. Please try again.',
        4000
      );
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
      showToast('warning', 'Invalid quantity', 'Please enter a valid positive quantity', 3000);
      return;
    }

    // Large quantity safety confirmation
    if (quantity > SAFE_STOCK_THRESHOLD) {
      const confirmed = window.confirm(
        `Large Stock Update Warning\n\nYou are about to ${type === 'IN' ? 'add' : 'remove'} ${quantity} items.\n\nIs this correct?`
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
