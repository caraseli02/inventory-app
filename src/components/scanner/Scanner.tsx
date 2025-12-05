import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

const Scanner = ({ onScanSuccess }: ScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regionId = 'reader';

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
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Success callback
            onScanSuccess(decodedText);
            // Stop scanning immediately after success to prevent multiple reads
            scanner.stop().catch((err) => console.error('Failed to stop scanner', err));
          },
          () => {
            // parse error, ignore specific errors like "no QR code found" to avoid log spam
            // use the error if needed or log only severe ones
          }
        );
      } catch (err) {
        setError('Failed to start scanner. Please check camera permissions.');
        console.error(err);
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
  }, [onScanSuccess]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-lg shadow-xl bg-black relative">
      <div id={regionId} className="w-full h-[300px] bg-black"></div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 p-4 text-center">
          {error}
        </div>
      )}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm pointer-events-none">
        Align code within frame
      </div>
    </div>
  );
};

export default Scanner;
