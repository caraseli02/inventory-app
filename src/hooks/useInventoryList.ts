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
        // Data integrity checks: ensure values are valid numbers
        const stockValue = product.fields['Current Stock Level'];
        const minValue = product.fields['Min Stock Level'];

        const currentStock = typeof stockValue === 'number' && Number.isFinite(stockValue)
          ? stockValue
          : 0;
        const minStock = typeof minValue === 'number' && Number.isFinite(minValue)
          ? minValue
          : 0;

        // Only filter products that have a defined minimum stock level
        return currentStock < minStock && minStock > 0;
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
        case 'stock': {
          const aStock = a.fields['Current Stock Level'];
          const bStock = b.fields['Current Stock Level'];
          aValue = typeof aStock === 'number' && Number.isFinite(aStock) ? aStock : 0;
          bValue = typeof bStock === 'number' && Number.isFinite(bStock) ? bStock : 0;
          break;
        }
        case 'price': {
          const aPrice = a.fields.Price;
          const bPrice = b.fields.Price;
          aValue = typeof aPrice === 'number' && Number.isFinite(aPrice) ? aPrice : 0;
          bValue = typeof bPrice === 'number' && Number.isFinite(bPrice) ? bPrice : 0;
          break;
        }
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
