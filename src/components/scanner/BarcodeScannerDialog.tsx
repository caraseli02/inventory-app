import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanSuccess: (barcode: string) => void;
}

/**
 * Compact barcode scanner dialog for use in forms
 * Opens camera, scans barcode, and returns result
 *
 * FIXES APPLIED:
 * - Abort flag prevents race condition on unmount
 * - useRef for callbacks prevents unnecessary re-initialization
 * - Improved error callback with consecutive error tracking
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }: BarcodeScannerDialogProps) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const regionId = 'barcode-scanner-dialog';

  // Use refs for callbacks to prevent useEffect re-runs when parent re-renders
  const onScanSuccessRef = useRef(onScanSuccess);
  const onOpenChangeRef = useRef(onOpenChange);

  // Keep callback refs up to date
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onOpenChangeRef.current = onOpenChange;
  }, [onScanSuccess, onOpenChange]);

  // Cleanup helper with better error context
  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Failed to clean up barcode scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // Track if this effect has been aborted
    let isAborted = false;

    if (!open) {
      // Cleanup when dialog closes
      cleanupScanner();
      return;
    }

    // Initialize scanner when dialog opens
    const initScanner = async () => {
      // Check abort flag before starting
      if (isAborted) return;

      try {
        // Reset state at start of async operation
        setIsInitializing(true);
        setError(null);

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const scanner = new Html5Qrcode(regionId);

        // Check abort flag after creating scanner
        if (isAborted) {
          scanner.clear();
          return;
        }

        scannerRef.current = scanner;

        const config = {
          formatsToSupport: formatsToSupport,
          fps: 30,
          qrbox: { width: 200, height: 200 },
        };

        // Track consecutive errors for debugging
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 50;

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Check abort flag before handling success
            if (isAborted) return;

            const cleanCode = decodedText.trim();
            const validLengths = [8, 12, 13];
            if (!validLengths.includes(cleanCode.length)) {
              return; // Ignore invalid barcodes
            }

            consecutiveErrors = 0; // Reset on success

            // Success - use refs to avoid stale closures
            onScanSuccessRef.current(cleanCode);
            onOpenChangeRef.current(false);
          },
          (errorMessage) => {
            // "No barcode found" is expected during continuous scanning
            if (errorMessage?.includes('No barcode') || errorMessage?.includes('NotFoundException')) {
              return;
            }

            // Track unexpected errors for debugging
            consecutiveErrors++;
            if (consecutiveErrors === MAX_CONSECUTIVE_ERRORS) {
              console.warn('Barcode scanner experiencing repeated errors:', errorMessage);
            }
          }
        );

        // Check abort flag after starting
        if (isAborted) {
          await cleanupScanner();
          return;
        }

        setIsInitializing(false);
      } catch (err) {
        // Don't set error if aborted
        if (isAborted) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Provide specific error messages
        if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission')) {
          setError(t('scanner.cameraError') || 'Camera permission denied. Please allow camera access.');
        } else if (errorMessage.includes('NotFoundError')) {
          setError(t('scanner.cameraNotFound') || 'No camera found on this device.');
        } else {
          setError(t('scanner.cameraError') || 'Failed to start camera. Check permissions.');
        }

        setIsInitializing(false);
        console.error('Scanner init error:', err);
      }
    };

    // Delay to ensure DOM is ready (dialog animation takes ~300ms)
    const timer = setTimeout(initScanner, 350);

    // Cleanup function
    return () => {
      isAborted = true;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [open, cleanupScanner, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-stone-200 flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">{t('scanner.title')}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative bg-black aspect-square">
          <div id={regionId} className="w-full h-full" />

          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-white text-sm">{t('loading.scanner')}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
              <div className="text-center">
                <p className="text-red-400 mb-3">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-white border-white/50"
                >
                  {t('product.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 text-center text-sm text-stone-600">
          {t('scanner.emptyState')}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;
