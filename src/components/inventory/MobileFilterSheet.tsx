import { Search, X, ArrowUp, ArrowDown, Upload, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { hasActiveFilters } from '../../lib/filters';
import type { InventoryFilters } from '../../hooks/useInventoryList';

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: InventoryFilters;
  categories: string[];
  onFilterChange: <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) => void;
  onReset: () => void;
  onImport: () => void;
  onExport: () => void;
}

export const MobileFilterSheet = ({
  open,
  onOpenChange,
  filters,
  categories,
  onFilterChange,
  onReset,
  onImport,
  onExport,
}: MobileFilterSheetProps) => {
  const { t } = useTranslation();

  const activeFilters = hasActiveFilters(filters);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-4 flex-shrink-0">
          <SheetTitle className="text-xl font-bold text-stone-900">
            {t('inventory.filters.title', 'Filters & Actions')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('inventory.filters.description', 'Filter and sort your inventory')}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Search Section */}
          <div className="space-y-2">
            <Label htmlFor="mobile-search" className="text-sm font-semibold text-stone-700">
              🔍 {t('inventory.search', 'Search')}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                id="mobile-search"
                type="text"
                value={filters.searchQuery}
                onChange={(e) => onFilterChange('searchQuery', e.target.value)}
                placeholder={t('inventory.searchPlaceholder', 'Search by name or barcode...')}
                className="h-12 pl-10 pr-10 border-2 border-stone-300"
              />
              {filters.searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                  onClick={() => onFilterChange('searchQuery', '')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Category Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-stone-700">
              📁 {t('inventory.filters.category', 'Category')}
            </Label>
            <RadioGroup
              value={filters.category || 'all'}
              onValueChange={(value) => onFilterChange('category', value === 'all' ? '' : value)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border-2 border-stone-200 hover:bg-stone-50 transition-colors">
                <RadioGroupItem value="all" id="cat-all" />
                <Label htmlFor="cat-all" className="flex-1 cursor-pointer font-medium">
                  {t('inventory.filters.allCategories', 'All Categories')}
                </Label>
              </div>
              {categories.map((category) => (
                <div
                  key={category}
                  className="flex items-center space-x-3 p-3 rounded-lg border-2 border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  <RadioGroupItem value={category} id={`cat-${category}`} />
                  <Label htmlFor={`cat-${category}`} className="flex-1 cursor-pointer font-medium">
                    {t(`categories.${category}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Stock Status Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-stone-700">
              📊 {t('inventory.filters.stockStatus', 'Stock Status')}
            </Label>
            <ToggleGroup
              type="single"
              value={filters.lowStockOnly ? 'low' : 'all'}
              onValueChange={(value) => onFilterChange('lowStockOnly', value === 'low')}
              className="grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem
                value="all"
                className="h-12 border-2 border-stone-300 data-[state=on]:bg-[var(--color-forest)] data-[state=on]:text-white data-[state=on]:border-[var(--color-forest)]"
              >
                {t('inventory.filters.allProducts', 'All Products')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="low"
                className="h-12 border-2 border-stone-300 data-[state=on]:bg-[var(--color-terracotta)] data-[state=on]:text-white data-[state=on]:border-[var(--color-terracotta)]"
              >
                {t('inventory.filters.lowStockOnly', 'Low Stock Only')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Sort Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-stone-700">
              ↕️ {t('inventory.filters.sortBy', 'Sort By')}
            </Label>
            <ToggleGroup
              type="single"
              value={filters.sortField}
              onValueChange={(value: string) => {
                if (value === 'name' || value === 'stock' || value === 'price' || value === 'category') {
                  onFilterChange('sortField', value);
                }
              }}
              className="grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem value="name" className="h-12 border-2 border-stone-300">
                {t('inventory.sort.name', 'Name')}
              </ToggleGroupItem>
              <ToggleGroupItem value="stock" className="h-12 border-2 border-stone-300">
                {t('inventory.sort.stock', 'Stock')}
              </ToggleGroupItem>
              <ToggleGroupItem value="price" className="h-12 border-2 border-stone-300">
                {t('inventory.sort.price', 'Price')}
              </ToggleGroupItem>
              <ToggleGroupItem value="category" className="h-12 border-2 border-stone-300">
                {t('inventory.sort.category', 'Category')}
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={filters.sortDirection}
              onValueChange={(value: string) => {
                if (value === 'asc' || value === 'desc') {
                  onFilterChange('sortDirection', value);
                }
              }}
              className="grid grid-cols-2 gap-2"
            >
              <ToggleGroupItem
                value="asc"
                className="h-12 border-2 border-stone-300 data-[state=on]:bg-[var(--color-lavender)] data-[state=on]:text-white"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                {t('inventory.sort.ascending', 'Ascending')}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="desc"
                className="h-12 border-2 border-stone-300 data-[state=on]:bg-[var(--color-lavender)] data-[state=on]:text-white"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                {t('inventory.sort.descending', 'Descending')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-stone-200" />

          {/* Actions Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-stone-700">
              {t('inventory.filters.actions', 'Actions')}
            </Label>
            <Button
              variant="outline"
              className="w-full h-12 border-2 border-stone-300 justify-start"
              onClick={() => {
                onImport();
                onOpenChange(false);
              }}
            >
              <Upload className="h-4 w-4 mr-3" />
              {t('inventory.import', 'Import Products')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 border-2 border-stone-300 justify-start"
              onClick={() => {
                onExport();
                onOpenChange(false);
              }}
            >
              <Download className="h-4 w-4 mr-3" />
              {t('inventory.export', 'Export Products')}
            </Button>
          </div>

          {/* Divider */}
          {activeFilters && <div className="border-t-2 border-stone-200" />}

          {/* Clear Filters */}
          {activeFilters && (
            <Button
              variant="ghost"
              className="w-full h-12 text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)]/10 font-semibold"
              onClick={() => {
                onReset();
                // Allow filter state to update before closing sheet
                setTimeout(() => onOpenChange(false), 0);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              {t('inventory.filters.clearAll', 'Clear All Filters')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
