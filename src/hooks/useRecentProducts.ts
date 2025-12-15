import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllProducts } from '../lib/api';
import type { Product } from '../types';
import { logger } from '../lib/logger';

const RECENT_PRODUCTS_KEY = 'recentProducts';
const MAX_RECENT_ITEMS = 8;

/**
 * Hook to track recently used products
 * - Stores product IDs in localStorage for persistence
 * - Returns actual Product objects from cached data
 * - Most recent items appear first
 */
export const useRecentProducts = () => {
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_PRODUCTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.warn('Failed to load recent products from localStorage', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        key: RECENT_PRODUCTS_KEY,
      });
      return [];
    }
  });

  // Fetch all products to resolve IDs to actual products
  const { data: allProducts } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5,
  });

  // Persist to localStorage when recentIds changes
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(recentIds));
    } catch (error) {
      logger.error('Failed to save recent products to localStorage', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        key: RECENT_PRODUCTS_KEY,
        idsCount: recentIds.length,
        isQuotaError: error instanceof DOMException && error.name === 'QuotaExceededError',
      });
    }
  }, [recentIds]);

  // Add a product to recent list (moves to front if already exists)
  const addRecentProduct = useCallback((productId: string) => {
    setRecentIds((prev) => {
      // Remove if already exists (to move to front)
      const filtered = prev.filter((id) => id !== productId);
      // Add to front, limit to MAX_RECENT_ITEMS
      return [productId, ...filtered].slice(0, MAX_RECENT_ITEMS);
    });
  }, []);

  // Clear all recent products
  const clearRecentProducts = useCallback(() => {
    setRecentIds([]);
  }, []);

  // Resolve IDs to actual Product objects
  const recentProducts: Product[] = recentIds
    .map((id) => allProducts?.find((p) => p.id === id))
    .filter((p): p is Product => p !== undefined);

  return {
    recentProducts,
    addRecentProduct,
    clearRecentProducts,
    hasRecentProducts: recentProducts.length > 0,
  };
};
