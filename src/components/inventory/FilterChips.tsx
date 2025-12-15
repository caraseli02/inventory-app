import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useTranslation } from 'react-i18next';
import type { InventoryFilters } from '../../hooks/useInventoryList';

interface FilterChipsProps {
  filters: InventoryFilters;
  onClearFilter: (key: keyof InventoryFilters) => void;
}

export const FilterChips = ({ filters, onClearFilter }: FilterChipsProps) => {
  const { t } = useTranslation();

  const chips: Array<{
    key: keyof InventoryFilters;
    label: string;
  }> = [];

  // Add search query chip
  if (filters.searchQuery) {
    chips.push({
      key: 'searchQuery',
      label: `"${filters.searchQuery}"`,
    });
  }

  // Add category chip
  if (filters.category) {
    chips.push({
      key: 'category',
      label: t(`categories.${filters.category}`),
    });
  }

  // Add low stock chip
  if (filters.lowStockOnly) {
    chips.push({
      key: 'lowStockOnly',
      label: t('inventory.filters.lowStockOnly', 'Low Stock'),
    });
  }

  // Add sort chip (only if not default)
  if (filters.sortField !== 'name' || filters.sortDirection !== 'asc') {
    const sortLabel = {
      name: t('inventory.sort.name', 'Name'),
      stock: t('inventory.sort.stock', 'Stock'),
      price: t('inventory.sort.price', 'Price'),
      category: t('inventory.sort.category', 'Category'),
    }[filters.sortField];

    const directionSymbol = filters.sortDirection === 'asc' ? '↑' : '↓';

    chips.push({
      key: 'sortField',
      label: `${sortLabel} ${directionSymbol}`,
    });
  }

  // If no chips, return null
  if (chips.length === 0) {
    return null;
  }

  // Max visible chips (show "+N more" if overflow)
  const MAX_VISIBLE = 3;
  const visibleChips = chips.slice(0, MAX_VISIBLE);
  const remainingCount = chips.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleChips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="h-7 pl-2.5 pr-1 bg-stone-100 border border-stone-300 text-stone-700 hover:bg-stone-200 transition-colors"
        >
          <span className="text-xs font-medium">{chip.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-1 hover:bg-stone-300 rounded-full p-0"
            onClick={() => onClearFilter(chip.key)}
            aria-label={t('inventory.filters.clearFilter', { filter: chip.label })}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge
          variant="secondary"
          className="h-7 px-2.5 bg-stone-100 border border-stone-300 text-stone-600"
        >
          <span className="text-xs font-medium">+{remainingCount} {t('inventory.filters.more', 'more')}</span>
        </Badge>
      )}
    </div>
  );
};
