import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { DesktopFilterBar } from './DesktopFilterBar';
import { MobileFilterSheet } from './MobileFilterSheet';
import { FilterChips } from './FilterChips';
import type { InventoryFilters } from '../../hooks/useInventoryList';

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
  onImport: () => void;
  onExport: () => void;
}

export const InventoryFiltersBar = (props: InventoryFiltersProps) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    filters,
    filteredCount,
    totalProducts,
    onFilterChange,
    onRefresh,
    isRefreshing = false,
  } = props;

  const hasActiveFilters =
    filters.searchQuery ||
    filters.category ||
    filters.lowStockOnly ||
    filters.sortField !== 'name' ||
    filters.sortDirection !== 'asc';

  const productCountText =
    filteredCount === totalProducts
      ? `${totalProducts}`
      : `${filteredCount}/${totalProducts}`;

  return (
    <>
      {/* Desktop View (≥768px) */}
      <div className="hidden md:block">
        <DesktopFilterBar {...props} />
      </div>

      {/* Mobile View (<768px) */}
      <div className="md:hidden space-y-2">
        {/* Row 1: Search + Filter Button + Refresh */}
        <div className="flex gap-2">
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSheetOpen(true)}
            className="h-11 w-11 border-2 border-stone-300 relative"
            aria-label={t('inventory.openFilters', 'Open filters')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--color-terracotta)] text-white text-[10px] font-bold flex items-center justify-center">
                {[
                  filters.category,
                  filters.lowStockOnly,
                  filters.sortField !== 'name',
                  filters.sortDirection !== 'asc',
                ].filter(Boolean).length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-11 w-11 border-2 border-stone-300"
            aria-label={t('inventory.refresh', 'Refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Row 2: Active filter chips + count (only show if filters active) */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <FilterChips
              filters={filters}
              onClearFilter={(key) => {
                if (key === 'searchQuery') onFilterChange('searchQuery', '');
                if (key === 'category') onFilterChange('category', '');
                if (key === 'lowStockOnly') onFilterChange('lowStockOnly', false);
                if (key === 'sortField') {
                  onFilterChange('sortField', 'name');
                  onFilterChange('sortDirection', 'asc');
                }
              }}
            />
            <span className="ml-auto text-sm text-stone-600 font-medium whitespace-nowrap">
              {productCountText}
            </span>
          </div>
        )}

        {/* Mobile Filter Sheet */}
        <MobileFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          {...props}
        />
      </div>
    </>
  );
};
