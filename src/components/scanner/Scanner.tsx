import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Video, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { logger } from '../../lib/logger';
import { ScannerOverlay } from './ScannerOverlay';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  scannerId?: string;
}

const Scanner = ({ onScanSuccess, scannerId = 'reader' }: ScannerProps) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const regionId = scannerId;
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);

  // Keep callback ref up to date without triggering useEffect
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  // Retry handler to re-initialize the scanner
  const handleRetry = useCallback(() => {
    // Clean up existing scanner first
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch((err) => {
            logger.debug('Scanner stop failed during retry (expected)', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
        scannerRef.current.clear();
      } catch (cleanupError) {
        // Log cleanup errors for debugging, but don't block retry
        logger.warn('Scanner cleanup error during retry', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          errorType: cleanupError instanceof Error ? cleanupError.name : typeof cleanupError,
        });
      }
      scannerRef.current = null;
    }
    setError(null);
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // strict mode safety check: if already initialized, don't re-init
    if (scannerRef.current) return;

    const initScanner = async () => {
      try {
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
          fps: 30, // Increased from 10 to 30 for better iPad camera detection
          qrbox: { width: 280, height: 200 }, // Match ScannerOverlay frame dimensions
          // Removed aspectRatio constraint to allow camera native aspect ratio
        };

        // Camera constraint for rear camera
        // html5-qrcode requires exactly 1 key in the constraint object
        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Validate barcode length - standard barcodes are 8, 12, or 13 digits
            // UPC-E: 8 digits, UPC-A: 12 digits, EAN-13: 13 digits, EAN-8: 8 digits
            const cleanCode = decodedText.trim();
            const validLengths = [8, 12, 13];
            if (!validLengths.includes(cleanCode.length)) {
              logger.warn('Ignored partial/invalid barcode', {
                barcode: cleanCode,
                length: cleanCode.length,
                scannerId: regionId,
              });
              return; // Ignore partial or invalid barcodes
            }

            // Prevent duplicate scans within 2 seconds
            const now = Date.now();
            if (
              lastScanRef.current &&
              lastScanRef.current.code === cleanCode &&
              now - lastScanRef.current.timestamp < 2000
            ) {
              return; // Ignore duplicate scan
            }

            lastScanRef.current = { code: cleanCode, timestamp: now };
            onScanSuccessRef.current(cleanCode);
          },
          () => {
            // html5-qrcode calls this callback on EVERY frame without a valid barcode.
            // This is normal behavior, not an error - simply means "no barcode in this frame".
            // We intentionally ignore all these "errors" to prevent console spam.
            // Real scanner errors are caught in the catch block below.
          }
        );
      } catch (err) {
        logger.error('Scanner initialization failed', {
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          scannerId: regionId,
          timestamp: new Date().toISOString(),
        });

        // Provide specific error messages based on error type
        // Using fallback strings to prevent showing raw translation keys to users
        let userMessage = t('scanner.initFailed', 'Failed to start scanner.') + ' ';

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.message.includes('permission')) {
            userMessage += t('scanner.permissionError', 'Please grant camera permissions in your browser settings.');
          } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
            userMessage += t('scanner.notFoundError', 'No camera found. Connect a camera or use manual entry.');
          } else if (err.name === 'NotReadableError' || err.message.includes('in use')) {
            userMessage += t('scanner.inUseError', 'Camera is in use by another app. Close other apps.');
          } else if (err.message.includes('HTTPS') || err.message.includes('secure')) {
            userMessage += t('scanner.httpsError', 'Camera requires a secure connection (HTTPS).');
          } else {
            userMessage += `Error: ${err.message}`;
          }
        } else {
          userMessage += t('scanner.checkPermissions', 'Please check camera permissions and try again.');
        }

        setError(userMessage);
      }
    };

    // delay init slightly to ensure DOM is ready
    const timer = setTimeout(() => {
      initScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current
            .stop()
            .then(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
              logger.debug('Scanner stopped successfully');
            })
            .catch((err) => {
              logger.error('Failed to stop scanner during cleanup', {
                errorMessage: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
                timestamp: new Date().toISOString(),
              });

              // Still try to clear even if stop failed
              try {
                scannerRef.current?.clear();
              } catch (clearError) {
                logger.error('Failed to clear scanner after stop failure', {
                  errorMessage: clearError instanceof Error ? clearError.message : String(clearError),
                });
              }

              scannerRef.current = null;

              // Set error state to inform user
              setError(t('scanner.cleanupFailed', 'Camera cleanup error. You may need to reload the page.'));
            });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    };
  }, [regionId, retryCount]);

  return (
    <div className="w-full overflow-hidden bg-black relative" style={{ aspectRatio: '4/3' }}>
      {error ? (
        <div className="absolute inset-0 flex flex-col bg-amber-50 border-4 border-amber-400 text-amber-900 m-2 rounded-lg">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="space-y-2 max-w-sm text-center">
              <Video className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="font-bold text-base">{t('scanner.cameraUnavailable', 'Camera Unavailable')}</p>
              <p className="text-xs text-amber-800">{error}</p>
            </div>
          </div>
          <div className="p-4">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full h-12 border-2 border-amber-400 text-amber-800 hover:bg-amber-100"
              aria-label={t('scanner.retry', 'Try Again')}
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              {t('scanner.retry', 'Try Again')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Scanner video container - html5-qrcode renders here */}
          <div id={regionId} className="absolute inset-0 [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!max-w-none [&_video]:!max-h-none" />
          <ScannerOverlay />
        </>
      )}
      {/* Bottom text - positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-stone-100 py-1.5 text-center text-stone-700 text-xs">
        {t('scanner.alignCode', 'Align code within frame')}
      </div>
    </div>
  );
};

export default Scanner;
