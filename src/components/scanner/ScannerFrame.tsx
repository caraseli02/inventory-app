import type { FormEvent } from 'react';
import Scanner from './Scanner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { CloseIcon, WarningIcon } from '../ui/Icons';

interface ScannerFrameProps {
  scannerId: string;
  onScanSuccess: (code: string) => void;
  showScanner: boolean;
  onToggleScanner: (show: boolean) => void;
  manualCode: string;
  onManualCodeChange: (code: string) => void;
  onManualSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  error: string | null;
  onClearError: () => void;
  size?: 'default' | 'small';
}

/**
 * ScannerFrame component with corner brackets, manual entry, loading state, and error display
 */
export const ScannerFrame = ({
  scannerId,
  onScanSuccess,
  showScanner,
  onToggleScanner,
  manualCode,
  onManualCodeChange,
  onManualSubmit,
  isPending,
  error,
  onClearError,
  size = 'default',
}: ScannerFrameProps) => {
  const textSize = size === 'small' ? 'text-sm' : '';

  return (
    <div>
      {/* Scanner Frame */}
      <div className="relative mx-auto w-full max-w-lg aspect-square">
        {/* Corner Brackets */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Top Left */}
          <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-stone-700" />
          {/* Top Right */}
          <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-stone-700" />
          {/* Bottom Left */}
          <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-stone-700" />
          {/* Bottom Right */}
          <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-stone-700" />

          {/* Scan Line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-700 shadow-lg" />
        </div>

        {/* Scanner or Manual Entry */}
        <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
          {showScanner ? (
            <Scanner onScanSuccess={onScanSuccess} scannerId={scannerId} />
          ) : (
            <div className="flex items-center justify-center h-full bg-stone-900">
              <div className="text-center px-4 w-full max-w-xs">
                <form onSubmit={onManualSubmit} className="space-y-4">
                  <Input
                    type="text"
                    value={manualCode}
                    onChange={(e) => onManualCodeChange(e.target.value)}
                    className={`w-full bg-white border-2 border-stone-300 rounded-lg p-3 text-stone-900 text-center tracking-widest focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 ${textSize}`}
                    placeholder="Enter barcode"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={manualCode.length < 3 || isPending}
                    className={`w-full bg-white hover:bg-stone-100 text-stone-900 ${textSize}`}
                  >
                    {isPending ? 'Searching…' : 'Add Item'}
                  </Button>
                </form>
                <Button
                  variant="ghost"
                  onClick={() => onToggleScanner(true)}
                  className={`mt-4 text-white hover:text-white hover:bg-white/10 ${textSize}`}
                >
                  Use Camera
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
            <Spinner size="md" label="Searching…" />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-900 p-3 rounded-lg text-sm flex items-start gap-2">
          <WarningIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <p className="font-semibold">Not Found</p>
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
