import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { getAllProducts } from '../lib/api';
import type { Product } from '../types';
import { logger } from '../lib/logger';

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
    if (!query.data || !debouncedQuery.trim()) {
      return [];
    }

    const searchLower = debouncedQuery.toLowerCase().trim();

    try {
      // Filter products that match name or barcode
      const matches = query.data.filter((product) => {
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
          return false; // Skip problematic products
        }
      });

      // Sort by relevance: exact matches first, then starts-with, then contains
      const sorted = matches.sort((a, b) => {
        try {
          const aName = a.fields.Name.toLowerCase();
          const bName = b.fields.Name.toLowerCase();
          const aBarcode = a.fields.Barcode?.toLowerCase() ?? '';
          const bBarcode = b.fields.Barcode?.toLowerCase() ?? '';

          // Exact match gets highest priority
          const aExact = aName === searchLower || aBarcode === searchLower;
          const bExact = bName === searchLower || bBarcode === searchLower;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Starts-with gets second priority
          const aStartsWith = aName.startsWith(searchLower) || aBarcode.startsWith(searchLower);
          const bStartsWith = bName.startsWith(searchLower) || bBarcode.startsWith(searchLower);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;

          // Alphabetical sort for equal relevance
          return aName.localeCompare(bName);
        } catch (error) {
          logger.warn('Failed to sort products in search', {
            productAId: a.id,
            productBId: b.id,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          return 0; // Keep original order on error
        }
      });

      // Return top 8 results for dropdown
      return sorted.slice(0, 8);
    } catch (error) {
      logger.error('Critical error in product search filter', {
        searchQuery: debouncedQuery,
        productsCount: query.data.length,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return []; // Return empty results on critical error
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
