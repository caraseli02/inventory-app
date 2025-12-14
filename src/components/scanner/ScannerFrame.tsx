import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Scanner from './Scanner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { CloseIcon, WarningIcon } from '../ui/Icons';
import { Plus, RefreshCw } from 'lucide-react';

interface ScannerFrameProps {
  scannerId: string;
  onScanSuccess: (code: string) => void;
  manualCode: string;
  onManualCodeChange: (code: string) => void;
  onManualSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  error: string | null;
  onClearError: () => void;
  size?: 'default' | 'small';
}

/**
 * ScannerFrame component with always-visible scanner and manual input below
 */
export const ScannerFrame = ({
  scannerId,
  onScanSuccess,
  manualCode,
  onManualCodeChange,
  onManualSubmit,
  isPending,
  error,
  onClearError,
  size = 'default',
}: ScannerFrameProps) => {
  const { t } = useTranslation();
  const isSmall = size === 'small';

  return (
    <div className="flex flex-col gap-4">
      {/* Scanner Frame */}
      <div className={`relative mx-auto w-full ${isSmall ? 'max-w-sm' : 'max-w-lg'}`}>
        {/* Scanner - includes built-in ScannerOverlay with corner brackets */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
          <Scanner onScanSuccess={onScanSuccess} scannerId={scannerId} />
        </div>

        {/* Loading Overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm z-20 rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <span className="text-stone-600 font-medium text-sm">{t('scanner.searching')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Section */}
      <div className={`bg-white border-2 border-stone-200 rounded-xl ${isSmall ? 'p-3' : 'p-4'}`}>
        <label className={`text-stone-700 font-semibold mb-2 block ${isSmall ? 'text-xs' : 'text-sm'}`}>
          {t('scannerFrame.enterManually')}
        </label>
        <form onSubmit={onManualSubmit} className="flex gap-2">
          <Input
            type="text"
            value={manualCode}
            onChange={(e) => onManualCodeChange(e.target.value)}
            className={`flex-1 min-w-0 font-mono tracking-wider border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)] focus-visible:border-[var(--color-lavender)] ${isSmall ? 'h-10 text-sm' : 'h-12 text-base'}`}
            placeholder={t('scannerFrame.barcodePlaceholder')}
            disabled={isPending}
            aria-label={t('scannerFrame.enterManually')}
          />
          <Button
            type="submit"
            disabled={manualCode.length < 3 || isPending}
            className={`flex-shrink-0 font-semibold shadow-md transition-all ${isSmall ? 'h-10 px-4 text-sm' : 'h-12 px-6 text-base'} ${
              manualCode.length >= 3 && !isPending
                ? 'bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] text-white hover:opacity-90'
                : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
            }`}
            aria-label={isPending ? t('scannerFrame.adding') : t('scannerFrame.add')}
          >
            {isPending ? (
              <Spinner size="sm" className="border-stone-400 border-t-stone-600 !h-4 !w-4" />
            ) : (
              <>
                <Plus className={`${isSmall ? 'h-4 w-4' : 'h-5 w-5'} mr-1`} />
                {t('scannerFrame.add')}
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-900 p-4 rounded-xl flex items-start gap-3">
          <WarningIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{t('scannerFrame.notFound')}</p>
            <p className="text-red-700 text-xs mt-1 break-words">{error}</p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearError}
                className="border-red-300 text-red-700 hover:bg-red-100 h-9"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t('scannerFrame.tryAgain', 'Try again')}
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearError}
            className="text-red-600 hover:text-red-900 hover:bg-red-100 h-8 w-8 p-0 flex-shrink-0"
            aria-label={t('common.close', 'Close')}
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
