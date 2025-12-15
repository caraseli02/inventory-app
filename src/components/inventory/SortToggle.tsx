import { ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { SortField } from '../../hooks/useInventoryList';

interface SortToggleProps {
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  onChange: (field: SortField, direction: 'asc' | 'desc') => void;
  className?: string;
}

export const SortToggle = ({ sortField, sortDirection, onChange, className }: SortToggleProps) => {
  const { t } = useTranslation();

  // Create combined value like "name-asc", "stock-desc", etc.
  const currentValue = `${sortField}-${sortDirection}`;

  const handleChange = (value: string) => {
    const [field, direction] = value.split('-') as [SortField, 'asc' | 'desc'];
    onChange(field, direction);
  };

  const sortOptions = [
    { field: 'name' as SortField, label: t('inventory.sort.name', 'Name') },
    { field: 'stock' as SortField, label: t('inventory.sort.stock', 'Stock') },
    { field: 'price' as SortField, label: t('inventory.sort.price', 'Price') },
    { field: 'category' as SortField, label: t('inventory.sort.category', 'Category') },
  ];

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className={`h-10 border-2 border-stone-300 ${className || 'w-[140px]'}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map(({ field, label }) => (
          <div key={field}>
            <SelectItem value={`${field}-asc`} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-3.5 w-3.5 text-stone-600" />
                <span>{label}</span>
              </div>
            </SelectItem>
            <SelectItem value={`${field}-desc`} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-3.5 w-3.5 text-stone-600" />
                <span>{label}</span>
              </div>
            </SelectItem>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
};
