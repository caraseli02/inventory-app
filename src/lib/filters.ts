import type { InventoryFilters } from '../hooks/useInventoryList';

/**
 * Determines if any filters are currently active (non-default values)
 * @param filters - The current filter state
 * @returns true if any filters are active, false otherwise
 */
export function hasActiveFilters(filters: InventoryFilters): boolean {
  return Boolean(
    filters.searchQuery ||
    filters.category ||
    filters.lowStockOnly ||
    filters.sortField !== 'name' ||
    filters.sortDirection !== 'asc'
  );
}

/**
 * Creates a filter clearing handler function
 * @param onFilterChange - The filter change callback from the parent component
 * @returns A function that clears a specific filter by key
 */
export function createClearFilterHandler(
  onFilterChange: <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => void
): (key: keyof InventoryFilters) => void {
  return function clearFilter(key: keyof InventoryFilters): void {
    switch (key) {
      case 'searchQuery':
        onFilterChange('searchQuery', '');
        break;
      case 'category':
        onFilterChange('category', '');
        break;
      case 'lowStockOnly':
        onFilterChange('lowStockOnly', false);
        break;
      case 'sortField':
        onFilterChange('sortField', 'name');
        onFilterChange('sortDirection', 'asc');
        break;
      case 'sortDirection':
        // sortDirection is handled together with sortField
        onFilterChange('sortField', 'name');
        onFilterChange('sortDirection', 'asc');
        break;
      default: {
        // This should never happen due to TypeScript type checking,
        // but catch it anyway for runtime safety
        const exhaustiveCheck: never = key;
        console.error(`Unhandled filter key: ${exhaustiveCheck}`);
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(`Unhandled filter key: ${exhaustiveCheck}`);
        }
      }
    }
  };
}
