import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '../types';
import { useToast } from './useToast';
import { addStockMovement } from '../lib/api-provider';
import { logger } from '../lib/logger';

export function useQuickStockAdjust(products: Product[]) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());
  const quickAdjustLocksRef = useRef<Set<string>>(new Set());

  const handleQuickAdjust = useCallback(async (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const stockValue = product.fields['Current Stock Level'];
    const currentStock =
      typeof stockValue === 'number' && Number.isFinite(stockValue) ? stockValue : 0;
    const type = delta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(delta);

    if (type === 'OUT' && currentStock < quantity) {
      showToast(
        'error',
        t('product.insufficientStock'),
        t('product.cannotRemove', { quantity, available: currentStock }),
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
      const action = type === 'IN' ? t('toast.stockAdded') : t('toast.stockRemoved');
      showToast(
        'success',
        t('toast.stockUpdated'),
        t('toast.stockUpdatedMessage', { action, quantity, name: product.fields.Name }),
        3000
      );
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
      const errorMessage = err instanceof Error ? err.message : t('errors.unknownError');
      showToast('error', t('toast.updateFailed'), errorMessage, 5000);
    } finally {
      setLoadingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      quickAdjustLocksRef.current.delete(productId);
    }
  }, [products, queryClient, showToast, t]);

  return { handleQuickAdjust, loadingProducts };
}
