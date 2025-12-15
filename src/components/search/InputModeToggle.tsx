import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type InputMode = 'search' | 'scan';

interface InputModeToggleProps {
  /** Current input mode */
  mode: InputMode;
  /** Called when mode changes */
  onModeChange: (mode: InputMode) => void;
  /** Optional className for the container */
  className?: string;
}

/**
 * Toggle between Search and Scan input modes.
 * Search mode shows the product search dropdown.
 * Scan mode shows the barcode scanner.
 */
export const InputModeToggle = ({
  mode,
  onModeChange,
  className = '',
}: InputModeToggleProps) => {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (value) onModeChange(value as InputMode);
      }}
      className={`bg-zinc-100 p-1 rounded-lg ${className}`}
    >
      <ToggleGroupItem
        value="search"
        aria-label={t('search.modeSearch', 'Search mode')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-md text-zinc-600 data-[state=on]:bg-white data-[state=on]:text-zinc-900 data-[state=on]:shadow-sm transition-all duration-150 hover:text-zinc-900"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm font-medium">{t('search.search', 'Search')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="scan"
        aria-label={t('search.modeScan', 'Scan mode')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-md text-zinc-600 data-[state=on]:bg-white data-[state=on]:text-zinc-900 data-[state=on]:shadow-sm transition-all duration-150 hover:text-zinc-900"
      >
        <ScanBarcode className="h-4 w-4" />
        <span className="text-sm font-medium">{t('search.scan', 'Scan')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
