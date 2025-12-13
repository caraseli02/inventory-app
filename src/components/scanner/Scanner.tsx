import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { logger } from '../../lib/logger';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  scannerId?: string;
}

const Scanner = ({ onScanSuccess, scannerId = 'reader' }: ScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regionId = scannerId;
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);
  const onScanSuccessRef = useRef(onScanSuccess);

  // Keep callback ref up to date without triggering useEffect
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

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
          qrbox: { width: 250, height: 250 }, // Define scanning box to help camera focus
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
          (errorMessage: string) => {
            // Filter out expected "no code found" messages to avoid spam
            const isExpectedError =
              errorMessage.includes('No MultiFormat Readers') ||
              errorMessage.includes('NotFoundException') ||
              errorMessage.includes('No barcode or QR code detected');

            if (!isExpectedError) {
              // Log unexpected parse errors for debugging
              logger.warn('Scanner parse error (unexpected)', {
                errorMessage,
                scannerId: regionId,
                timestamp: new Date().toISOString(),
              });
            }
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
        let userMessage = 'Failed to start scanner. ';

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.message.includes('permission')) {
            userMessage += 'Please grant camera permissions in your browser settings.';
          } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
            userMessage += 'No camera found. Please connect a camera or use manual entry.';
          } else if (err.name === 'NotReadableError' || err.message.includes('in use')) {
            userMessage += 'Camera is already in use. Close other apps using the camera.';
          } else if (err.message.includes('HTTPS') || err.message.includes('secure')) {
            userMessage += 'Camera requires a secure connection (HTTPS).';
          } else {
            userMessage += `Error: ${err.message}`;
          }
        } else {
          userMessage += 'Please check camera permissions and try again.';
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
              setError('Camera cleanup failed. You may need to reload the page to use the scanner again.');
            });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    };
  }, [regionId]);

  return (
    <div className="w-full h-full overflow-hidden bg-black relative flex flex-col">
      <div id={regionId} className="w-full flex-1 bg-black"></div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-amber-50 border-4 border-amber-400 text-amber-900 p-6 text-center m-4 rounded-lg">
          <div className="space-y-3">
            <div className="flex justify-center">
              <svg className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-bold text-lg">Camera Unavailable</p>
            <p className="text-sm text-amber-800">{error}</p>
            <div className="pt-2 border-t border-amber-200">
              <p className="text-xs text-amber-700 font-medium">
                💡 You can still enter barcodes manually below
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-stone-100 py-2 text-center text-stone-700 text-sm">
        Align code within frame
      </div>
    </div>
  );
};

export default Scanner;
