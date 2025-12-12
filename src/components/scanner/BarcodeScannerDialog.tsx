import { useEffect, useRef, useState } from 'react';
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
 */
const BarcodeScannerDialog = ({ open, onOpenChange, onScanSuccess }: BarcodeScannerDialogProps) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const regionId = 'barcode-scanner-dialog';
  const prevOpenRef = useRef(open);

  useEffect(() => {
    // Handle cleanup when dialog closes
    if (!open && prevOpenRef.current) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          }).catch(console.error);
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    }
    prevOpenRef.current = open;

    if (!open) {
      return;
    }

    // Initialize scanner when dialog opens
    const initScanner = async () => {
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
        scannerRef.current = scanner;

        const config = {
          formatsToSupport: formatsToSupport,
          fps: 30,
          qrbox: { width: 200, height: 200 },
        };

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const cleanCode = decodedText.trim();
            const validLengths = [8, 12, 13];
            if (!validLengths.includes(cleanCode.length)) {
              return; // Ignore invalid barcodes
            }

            // Success - stop scanner and return result
            onScanSuccess(cleanCode);
            onOpenChange(false);
          },
          () => {
            // Ignore scan errors (no barcode found)
          }
        );

        setIsInitializing(false);
      } catch (err) {
        setError(t('scanner.cameraError') || 'Failed to start camera. Check permissions.');
        setIsInitializing(false);
        console.error('Scanner init error:', err);
      }
    };

    // Delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 200);
    return () => clearTimeout(timer);
  }, [open, onOpenChange, onScanSuccess, t]);

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

        <div className="relative bg-black aspect-square max-h-[60vh]">
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
