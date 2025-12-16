import { Search, X, RefreshCw, AlertTriangle, Upload, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterChips } from './FilterChips';
import { SortToggle } from './SortToggle';
import { hasActiveFilters, createClearFilterHandler } from '../../lib/filters';
import type { InventoryFilters } from '../../hooks/useInventoryList';

interface DesktopFilterBarProps {
  filters: InventoryFilters;
  categories: string[];
  totalProducts: number;
  filteredCount: number;
  onFilterChange: <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => void;
  onReset: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onImport: () => void;
  onExport: () => void;
}

export const DesktopFilterBar = ({
  filters,
  categories,
  totalProducts,
  filteredCount,
  onFilterChange,
  onReset,
  onRefresh,
  isRefreshing = false,
  onImport,
  onExport,
}: DesktopFilterBarProps) => {
  const { t } = useTranslation();

  const activeFilters = hasActiveFilters(filters);
  const clearFilterHandler = createClearFilterHandler(onFilterChange);

  const productCountText =
    filteredCount === totalProducts
      ? t('inventory.productsCount', '{count} products', { count: totalProducts })
      : t('inventory.productsFiltered', '{filtered} of {total}', { filtered: filteredCount, total: totalProducts });

  return (
    <div className="space-y-3">
      {/* Main row - Filters and Controls */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder={t('inventory.searchPlaceholder', 'Search by name or barcode...')}
            className="h-11 pl-10 pr-10 border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
          />
          {filters.searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={() => onFilterChange('searchQuery', '')}
              aria-label={t('inventory.clearSearch', 'Clear search')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Category Dropdown */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => onFilterChange('category', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-[150px] h-10 border-2 border-stone-300">
            <SelectValue placeholder={t('inventory.allCategories', 'All Categories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.filters.allCategories', 'All Categories')}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {t(`categories.${category}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Low Stock Toggle */}
        <Button
          variant={filters.lowStockOnly ? 'default' : 'outline'}
          size="icon"
          onClick={() => onFilterChange('lowStockOnly', !filters.lowStockOnly)}
          className={`h-10 w-10 ${
            filters.lowStockOnly
              ? 'bg-[var(--color-terracotta)] hover:bg-[var(--color-terracotta-dark)] text-white border-[var(--color-terracotta)]'
              : 'border-2 border-stone-300'
          }`}
          title={t('inventory.filters.lowStockOnly', 'Show low stock only')}
          aria-label={t('inventory.filters.lowStockOnly', 'Show low stock only')}
        >
          <AlertTriangle className="h-4 w-4" />
        </Button>

        {/* Sort Toggle */}
        <SortToggle
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          onChange={(field, direction) => {
            onFilterChange('sortField', field);
            onFilterChange('sortDirection', direction);
          }}
        />

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 w-10 border-2 border-stone-300"
          aria-label={t('inventory.refresh', 'Refresh')}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Import/Export Actions Row */}
      <div className="flex items-center justify-between">
        {/* Product Count */}
        <span className="text-sm text-stone-600 font-medium whitespace-nowrap">{productCountText}</span>

        <div className="flex gap-2">
          {/* Import Button */}
        <Button
          size="sm"
          onClick={onImport}
          className="h-10 font-semibold text-white"
          style={{
            background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          {t('inventory.import', 'Import')}
        </Button>

        {/* Export Button */}
        <Button
          size="sm"
          onClick={onExport}
          className="h-10 font-semibold text-white"
          style={{
            background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          {t('inventory.export', 'Export')}
        </Button>
        </div>
      </div>

      {/* Filter chips row - only if filters are active */}
      {activeFilters && (
        <div className="flex items-center justify-between">
          <FilterChips
            filters={filters}
            onClearFilter={clearFilterHandler}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-10 text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)]/10"
          >
            <X className="h-4 w-4 mr-2" />
            {t('inventory.filters.clearAll', 'Clear')}
          </Button>
        </div>
      )}
    </div>
  );
};
