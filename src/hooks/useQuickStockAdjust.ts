import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '../types';
import { useToast } from './useToast';
import { addStockMovement } from '../lib/api-provider';
import { logger } from '../lib/logger';
import type { ToastAction } from '../components/ui/toast';

interface StockAdjustment {
  productId: string;
  productName: string;
  delta: number;
  originalStock: number;
  timestamp: number;
}

export function useQuickStockAdjust(products: Product[]) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());
  const quickAdjustLocksRef = useRef<Set<string>>(new Set());
  const lastAdjustmentRef = useRef<StockAdjustment | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUndo = useCallback(async () => {
    const adjustment = lastAdjustmentRef.current;
    if (!adjustment) return;

    // Clear timeout since user is explicitly undoing
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    const { productId, productName, delta, originalStock } = adjustment;
    const reverseDelta = -delta;
    const type = reverseDelta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(reverseDelta);

    setLoadingProducts((prev) => new Set(prev).add(productId));

    try {
      await addStockMovement(productId, quantity, type);
      queryClient.setQueryData<Product[]>(['products', 'all'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((p) => {
          if (p.id !== productId) return p;
          return { ...p, fields: { ...p.fields, 'Current Stock Level': originalStock } };
        });
      });
      showToast('success', t('toast.undoSuccess', 'Undone'), t('toast.stockReverted', '{name} stock reverted', { name: productName }), 3000);
    } catch (err) {
      logger.error('Stock undo failed', { productId, productName, reverseDelta });
      showToast('error', t('toast.undoFailed', 'Undo Failed'), t('toast.undoFailedMessage', 'Could not revert stock change'), 5000);
    } finally {
      setLoadingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }

    // Clear the last adjustment
    lastAdjustmentRef.current = null;
  }, [queryClient, showToast, t]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleQuickAdjust = useCallback(async (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const stockValue = product.fields['Current Stock Level'];
    // Explicit null check for clarity - typeof null === 'object', but we guard against type mismatches
    const currentStock =
      (stockValue !== null && typeof stockValue === 'number' && Number.isFinite(stockValue)) ? stockValue : 0;
    const type = delta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(delta);

    if (type === 'OUT' && currentStock < quantity) {
      showToast(
        'error',
        t('product.insufficientStock', 'Insufficient Stock'),
        t('product.cannotRemove', 'Cannot remove {quantity} (only {available} available)', { quantity, available: currentStock }),
        4000
      );
      return;
    }

    if (quickAdjustLocksRef.current.has(productId)) {
      logger.debug('Prevented concurrent quick adjust', { productId });
      return;
    }
    quickAdjustLocksRef.current.add(productId);
    setLoadingProducts((prev) => new Set(prev).add(productId));

    // Clear any pending undo timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    const previousData = queryClient.getQueryData<Product[]>(['products', 'all']);
    queryClient.setQueryData<Product[]>(['products', 'all'], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map((p) => {
        if (p.id !== productId) return p;
        return { ...p, fields: { ...p.fields, 'Current Stock Level': currentStock + delta } };
      });
    });

    try {
      await addStockMovement(productId, quantity, type);
      const action = type === 'IN' ? t('toast.stockAdded', 'added') : t('toast.stockRemoved', 'removed');

      // Store the adjustment for potential undo
      lastAdjustmentRef.current = {
        productId,
        productName: product.fields.Name,
        delta,
        originalStock: currentStock,
        timestamp: Date.now(),
      };

      // Create undo action
      const undoAction: ToastAction = {
        label: t('toast.undo', 'Undo'),
        action: handleUndo,
      };

      // Show toast with undo button
      showToast(
        'success',
        t('toast.stockUpdated', 'Stock Updated'),
        t('toast.stockUpdatedMessage', '{action} {quantity} of {name}', { action, quantity, name: product.fields.Name }),
        5000,
        undoAction
      );

      // Auto-clear the adjustment after 5 seconds
      undoTimeoutRef.current = setTimeout(() => {
        lastAdjustmentRef.current = null;
        undoTimeoutRef.current = null;
      }, 5000);
    } catch (err) {
      logger.error('Stock adjustment failed', {
        productId,
        productName: product.fields.Name,
        quantity,
        type,
        currentStock,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      if (previousData) queryClient.setQueryData(['products', 'all'], previousData);
      const errorMessage = err instanceof Error ? err.message : t('errors.unknownError', 'An unknown error occurred');
      showToast('error', t('toast.updateFailed', 'Update Failed'), errorMessage, 5000);
    } finally {
      setLoadingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      quickAdjustLocksRef.current.delete(productId);
    }
  }, [products, queryClient, showToast, t, handleUndo]);

  return { handleQuickAdjust, loadingProducts };
}
