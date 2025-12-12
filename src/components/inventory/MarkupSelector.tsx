import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { type MarkupPercentage } from '@/hooks/useMarkupSetting';
import { Percent } from 'lucide-react';

interface MarkupSelectorProps {
  value: MarkupPercentage;
  onChange: (markup: MarkupPercentage) => void;
}

const MARKUP_OPTIONS: MarkupPercentage[] = [50, 70, 100];

export function MarkupSelector({ value, onChange }: MarkupSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-stone-600">
        <Percent className="h-4 w-4" />
        <span className="font-medium">{t('markup.label')}:</span>
      </div>
      <div className="flex rounded-lg border-2 border-stone-200 bg-stone-50 p-1">
        {MARKUP_OPTIONS.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            onClick={() => onChange(option)}
            className={`
              h-8 px-4 font-semibold transition-all
              ${value === option
                ? 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-dark)] hover:text-white'
                : 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
              }
            `}
          >
            {option}%
          </Button>
        ))}
      </div>
    </div>
  );
}
