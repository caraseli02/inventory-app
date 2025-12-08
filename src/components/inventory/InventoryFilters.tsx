import { Search, X, ArrowUpDown, RefreshCw } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { InventoryFilters, SortField } from '../../hooks/useInventoryList';

interface InventoryFiltersProps {
  filters: InventoryFilters;
  categories: string[];
  totalProducts: number;
  filteredCount: number;
  onFilterChange: <K extends keyof InventoryFilters>(
    key: K,
    value: InventoryFilters[K]
  ) => void;
  onReset: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const InventoryFiltersBar = ({
  filters,
  categories,
  totalProducts,
  filteredCount,
  onFilterChange,
  onReset,
  onRefresh,
  isRefreshing = false,
}: InventoryFiltersProps) => {
  const hasActiveFilters =
    filters.searchQuery ||
    filters.category ||
    filters.lowStockOnly ||
    filters.sortField !== 'name' ||
    filters.sortDirection !== 'asc';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          type="text"
          placeholder="Search by name or barcode..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange('searchQuery', e.target.value)}
          className="pl-10 h-12 bg-white border-2 border-stone-300 rounded-lg text-stone-900 placeholder:text-stone-400 focus-visible:ring-[var(--color-lavender)]"
        />
        {filters.searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={() => onFilterChange('searchQuery', '')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Category Filter */}
        <div className="relative">
          <Select
            value={filters.category || undefined}
            onValueChange={(value) => onFilterChange('category', value)}
          >
            <SelectTrigger className="w-[180px] h-10 border-2 border-stone-300">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.category && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-8 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-stone-100"
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange('category', '');
              }}
              title="Clear category filter"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Low Stock Filter */}
        <Button
          variant={filters.lowStockOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('lowStockOnly', !filters.lowStockOnly)}
          className={`h-10 ${
            filters.lowStockOnly
              ? 'bg-[var(--color-terracotta)] hover:bg-[var(--color-terracotta-dark)] text-white'
              : 'border-2 border-stone-300'
          }`}
        >
          Low Stock
        </Button>

        {/* Sort By */}
        <Select
          value={filters.sortField}
          onValueChange={(value) => onFilterChange('sortField', value as SortField)}
        >
          <SelectTrigger className="w-[140px] h-10 border-2 border-stone-300">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort Direction */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onFilterChange(
              'sortDirection',
              filters.sortDirection === 'asc' ? 'desc' : 'asc'
            )
          }
          className="h-10 w-10 p-0 border-2 border-stone-300"
          title={filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        >
          {filters.sortDirection === 'asc' ? '↑' : '↓'}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-10 text-stone-600 hover:text-stone-900"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}

        {/* Results Count */}
        <Badge variant="secondary" className="ml-auto bg-stone-100 border-stone-200">
          {filteredCount === totalProducts
            ? `${totalProducts} products`
            : `${filteredCount} of ${totalProducts}`}
        </Badge>

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 p-0 border-2 border-stone-300"
            title="Refresh inventory"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  );
};
