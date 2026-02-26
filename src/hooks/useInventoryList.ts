import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getAllProducts } from '../lib/api-provider';
import type { Product } from '../types';

export type SortField = 'name' | 'stock' | 'price' | 'category';
export type SortDirection = 'asc' | 'desc';

export interface InventoryFilters {
  searchQuery: string;
  category: string;
  lowStockOnly: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
}

function applyFilters(products: Product[], filters: InventoryFilters): Product[] {
  let result = products;

  if (filters.searchQuery.trim()) {
    const searchLower = filters.searchQuery.toLowerCase().trim();
    result = result.filter(
      p =>
        p.fields.Name.toLowerCase().includes(searchLower) ||
        (p.fields.Barcode?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  if (filters.category) {
    result = result.filter(p => p.fields.Category === filters.category);
  }

  if (filters.lowStockOnly) {
    result = result.filter(p => {
      const stockValue = p.fields['Current Stock Level'];
      const minValue = p.fields['Min Stock Level'];
      const currentStock = typeof stockValue === 'number' && Number.isFinite(stockValue) ? stockValue : 0;
      const minStock = typeof minValue === 'number' && Number.isFinite(minValue) ? minValue : 0;
      return currentStock < minStock && minStock > 0;
    });
  }

  return result;
}

function getSortKey(product: Product, sortField: SortField): string | number {
  switch (sortField) {
    case 'name': return product.fields.Name.toLowerCase();
    case 'stock': {
      const stock = product.fields['Current Stock Level'];
      return typeof stock === 'number' && Number.isFinite(stock) ? stock : 0;
    }
    case 'price': {
      const price = product.fields.Price;
      return typeof price === 'number' && Number.isFinite(price) ? price : 0;
    }
    case 'category': return (product.fields.Category ?? '').toLowerCase();
    default: return '';
  }
}

function sortProducts(products: Product[], sortField: SortField, sortDirection: SortDirection): Product[] {
  const withKeys = products.map(product => ({ product, sortKey: getSortKey(product, sortField) }));
  withKeys.sort((a, b) => {
    let comparison = 0;
    if (a.sortKey < b.sortKey) comparison = -1;
    if (a.sortKey > b.sortKey) comparison = 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  return withKeys.map(({ product }) => product);
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
    const filtered = applyFilters([...query.data], filters);
    return sortProducts(filtered, filters.sortField, filters.sortDirection);
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
    allProducts: query.data ?? [],
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
