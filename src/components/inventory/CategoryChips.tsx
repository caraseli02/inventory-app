import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

const COMMON_CATEGORIES = ['General', 'Produce', 'Dairy', 'Meat', 'Pantry', 'Snacks', 'Beverages'] as const;

export type Category = typeof COMMON_CATEGORIES[number];

interface CategoryChipsProps {
  selectedCategory: Category | null;
  onCategorySelect: (category: Category | null) => void;
}

export function CategoryChips({ selectedCategory, onCategorySelect }: CategoryChipsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* "All" option */}
      <Badge
        variant={selectedCategory === null ? 'default' : 'outline'}
        onClick={() => onCategorySelect(null)}
        className={`cursor-pointer whitespace-nowrap px-3 py-1.5 transition-all ${
          selectedCategory === null
            ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] border-transparent'
            : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
        }`}
      >
        {t('inventory.filters.allCategories', 'All')}
      </Badge>

      {COMMON_CATEGORIES.map((cat) => (
        <Badge
          key={cat}
          variant={selectedCategory === cat ? 'default' : 'outline'}
          onClick={() => onCategorySelect(cat)}
          className={`cursor-pointer whitespace-nowrap px-3 py-1.5 transition-all ${
            selectedCategory === cat
              ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] border-transparent'
              : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
          }`}
        >
          {t(`categories.${cat}`, cat)}
        </Badge>
      ))}
    </div>
  );
}
