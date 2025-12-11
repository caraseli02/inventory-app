import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

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
              console.warn(`Ignored partial/invalid barcode: ${cleanCode} (length: ${cleanCode.length})`);
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
            // parse error, ignore specific errors like "no QR code found" to avoid log spam
            // use the error if needed or log only severe ones
          }
        );
      } catch (err) {
        setError('Failed to start scanner. Please check camera permissions.');
        console.error('Scanner initialization failed:', err);
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
          scannerRef.current.stop().then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          }).catch(err => {
            console.error("Failed to stop scanner during cleanup", err);
          });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    };
  }, [regionId]);

  return (
    <div className="w-full h-full overflow-hidden bg-black relative">
      <div id={regionId} className="w-full h-full bg-black"></div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 p-4 text-center">
          {error}
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm pointer-events-none">
        Align code within frame
      </div>
    </div>
  );
};

export default Scanner;
