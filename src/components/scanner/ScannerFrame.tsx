import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Scanner from './Scanner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { CloseIcon, WarningIcon } from '../ui/Icons';

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
  const textSize = size === 'small' ? 'text-sm' : '';

  return (
    <div>
      {/* Scanner Frame */}
      <div className="relative mx-auto w-full max-w-lg min-h-[300px]">
        {/* Scanner - includes built-in ScannerOverlay with corner brackets */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <Scanner onScanSuccess={onScanSuccess} scannerId={scannerId} />
        </div>

        {/* Loading Overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
            <Spinner size="md" label={t('scanner.searching')} />
          </div>
        )}
      </div>

      {/* Always-visible Manual Input Section */}
      <div className="mt-4">
        <div className="bg-gradient-to-br from-stone-50 to-stone-100 border-2 border-stone-200 rounded-lg p-4">
          <label className={`text-stone-700 font-semibold mb-2 block ${textSize}`}>
            {t('scannerFrame.enterManually')}
          </label>
          <form onSubmit={onManualSubmit} className="flex gap-2">
            <Input
              type="text"
              value={manualCode}
              onChange={(e) => onManualCodeChange(e.target.value)}
              className={`flex-1 font-mono tracking-wider border-2 border-stone-300 focus-visible:ring-stone-400 ${textSize}`}
              placeholder={t('scannerFrame.barcodePlaceholder')}
              disabled={isPending}
            />
            <Button
              type="submit"
              disabled={manualCode.length < 3 || isPending}
              className={`text-white ${textSize}`}
              style={{
                background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
              }}
            >
              {isPending ? t('scannerFrame.adding') : t('scannerFrame.add')}
            </Button>
          </form>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-900 p-3 rounded-lg text-sm flex items-start gap-2">
          <WarningIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <p className="font-semibold">{t('scannerFrame.notFound')}</p>
            <p className="text-red-800 text-xs mt-1">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearError}
            className="text-red-600 hover:text-red-900 h-8 w-8 p-0"
          >
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};
