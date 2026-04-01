import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Settings, RefreshCw, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface SettingsMenuProps {
  onResetCache: () => Promise<void>;
  isResettingCache: boolean;
}

export function SettingsMenu({ onResetCache, isResettingCache }: SettingsMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleResetCache = async () => {
    setIsOpen(false);
    await onResetCache();
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 border-2 border-stone-200 bg-white/80 backdrop-blur-sm hover:border-stone-300"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline ml-2">{t('settings.menu', 'Settings')}</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-white rounded-xl border-2 border-stone-200 shadow-lg overflow-hidden">
            <div className="px-3 py-2 bg-stone-50 border-b border-stone-200">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                {t('settings.title', 'Settings')}
              </span>
            </div>

            <div className="p-1">
              <button
                type="button"
                onClick={handleResetCache}
                disabled={isResettingCache}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
              >
                <RefreshCw className={`h-4 w-4 text-stone-500 ${isResettingCache ? 'animate-spin' : ''}`} />
                <span className="flex-1">{t('pwa.resetAction', 'Reset Cache')}</span>
                {isResettingCache && <Check className="h-4 w-4 text-stone-400" />}
              </button>
            </div>

            <div className="px-3 py-2 bg-stone-50 border-t border-stone-200">
              <span className="text-xs text-stone-400">
                {t('settings.version', 'Version')} 1.0.0
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
