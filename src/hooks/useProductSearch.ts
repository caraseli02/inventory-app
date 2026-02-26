import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { getAllProducts } from '../lib/api-provider';
import type { Product } from '../types';
import { logger } from '../lib/logger';

function matchesSearch(product: Product, searchLower: string): boolean {
  try {
    const nameMatch = product.fields.Name.toLowerCase().includes(searchLower);
    const barcodeMatch = product.fields.Barcode?.toLowerCase().includes(searchLower) ?? false;
    return nameMatch || barcodeMatch;
  } catch (error) {
    logger.warn('Failed to filter product in search', {
      productId: product.id,
      productName: product.fields.Name,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function compareByRelevance(a: Product, b: Product, searchLower: string): number {
  try {
    const aName = a.fields.Name.toLowerCase();
    const bName = b.fields.Name.toLowerCase();
    const aBarcode = a.fields.Barcode?.toLowerCase() ?? '';
    const bBarcode = b.fields.Barcode?.toLowerCase() ?? '';
    const aExact = aName === searchLower || aBarcode === searchLower;
    const bExact = bName === searchLower || bBarcode === searchLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    const aStartsWith = aName.startsWith(searchLower) || aBarcode.startsWith(searchLower);
    const bStartsWith = bName.startsWith(searchLower) || bBarcode.startsWith(searchLower);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    return aName.localeCompare(bName);
  } catch (error) {
    logger.warn('Failed to sort products in search', {
      productAId: a.id,
      productBId: b.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Custom hook for fast product search with debouncing
 *
 * Features:
 * - Debounced search input (300ms delay)
 * - Searches by product name and barcode
 * - Returns top 8 results for dropdown display
 * - Uses cached product data from React Query
 * - Case-insensitive substring matching
 */
export const useProductSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all products (uses shared cache with inventory list)
  const query = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Filter products based on debounced search query
  const searchResults = useMemo((): Product[] => {
    if (!query.data || !debouncedQuery.trim()) return [];
    const searchLower = debouncedQuery.toLowerCase().trim();
    try {
      const matches = query.data.filter(p => matchesSearch(p, searchLower));
      return matches.sort((a, b) => compareByRelevance(a, b, searchLower)).slice(0, 8);
    } catch (error) {
      logger.error('Critical error in product search filter', {
        searchQuery: debouncedQuery,
        productsCount: query.data.length,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }, [query.data, debouncedQuery]);

  // Check if we're actively searching (query typed but results not yet filtered)
  const isSearching = searchQuery !== debouncedQuery && searchQuery.trim().length > 0;

  return {
    // Search state
    searchQuery,
    setSearchQuery,
    searchResults,

    // Loading states
    isLoading: query.isLoading,
    isSearching,
    error: query.error,

    // Helper
    hasResults: searchResults.length > 0,
    noResults: debouncedQuery.trim().length > 0 && searchResults.length === 0 && !query.isLoading,

    // Clear search
    clearSearch: () => {
      setSearchQuery('');
      setDebouncedQuery('');
    },
  };
};
