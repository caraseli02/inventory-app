import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getAllProducts } from '../lib/api';

export type SortField = 'name' | 'stock' | 'price' | 'category';
export type SortDirection = 'asc' | 'desc';

export interface InventoryFilters {
  searchQuery: string;
  category: string;
  lowStockOnly: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
}

/**
 * Custom hook for managing inventory list data with filtering and sorting
 *
 * Features:
 * - Fetches all products from Airtable
 * - Client-side search by name/barcode
 * - Filter by category
 * - Filter by low stock (Current Stock Level < Min Stock Level)
 * - Sort by name, stock, price, or category
 * - Auto-refetch on window focus
 * - 5-minute cache
 */
export const useInventoryList = () => {
  const [filters, setFilters] = useState<InventoryFilters>({
    searchQuery: '',
    category: '',
    lowStockOnly: false,
    sortField: 'name',
    sortDirection: 'asc',
  });

  // Fetch all products from Airtable
  const query = useQuery({
    queryKey: ['products', 'all'],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Client-side filtering and sorting
  const filteredAndSortedProducts = useMemo(() => {
    if (!query.data) return [];

    let result = [...query.data];

    // Apply search filter (name or barcode)
    if (filters.searchQuery.trim()) {
      const searchLower = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (product) =>
          product.fields.Name.toLowerCase().includes(searchLower) ||
          product.fields.Barcode.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (filters.category) {
      result = result.filter(
        (product) => product.fields.Category === filters.category
      );
    }

    // Apply low stock filter
    if (filters.lowStockOnly) {
      result = result.filter((product) => {
        const currentStock = product.fields['Current Stock Level'] ?? 0;
        const minStock = product.fields['Min Stock Level'] ?? 0;
        return currentStock < minStock;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      switch (filters.sortField) {
        case 'name':
          aValue = a.fields.Name.toLowerCase();
          bValue = b.fields.Name.toLowerCase();
          break;
        case 'stock':
          aValue = a.fields['Current Stock Level'] ?? 0;
          bValue = b.fields['Current Stock Level'] ?? 0;
          break;
        case 'price':
          aValue = a.fields.Price ?? 0;
          bValue = b.fields.Price ?? 0;
          break;
        case 'category':
          aValue = (a.fields.Category ?? '').toLowerCase();
          bValue = (b.fields.Category ?? '').toLowerCase();
          break;
      }

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [query.data, filters]);

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    if (!query.data) return [];
    const uniqueCategories = new Set(
      query.data
        .map((p) => p.fields.Category)
        .filter((cat): cat is string => cat != null && cat.trim() !== '')
    );
    return Array.from(uniqueCategories).sort();
  }, [query.data]);

  // Helper function to update a single filter
  const updateFilter = <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper function to reset all filters
  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      category: '',
      lowStockOnly: false,
      sortField: 'name',
      sortDirection: 'asc',
    });
  };

  return {
    // Query state
    products: filteredAndSortedProducts,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    // Filter state
    filters,
    updateFilter,
    resetFilters,
    categories,

    // Stats
    totalProducts: query.data?.length ?? 0,
    filteredCount: filteredAndSortedProducts.length,
  };
};
