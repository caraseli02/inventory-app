import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Camera, X, RotateCcw, Check } from 'lucide-react';

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (imageDataUrl: string) => void;
}

/**
 * Camera capture dialog for taking product photos
 * Returns base64 data URL of captured image
 */
const CameraCaptureDialog = ({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const prevOpenRef = useRef(open);

  // Cleanup function
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera
  useEffect(() => {
    // Handle cleanup when dialog closes
    if (!open && prevOpenRef.current) {
      stopCamera();
    }
    prevOpenRef.current = open;

    if (!open) {
      return;
    }

    const initCamera = async () => {
      try {
        // Reset state at start of async operation
        setCapturedImage(null);
        setIsInitializing(true);
        setError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsInitializing(false);
      } catch (err) {
        console.error('Camera init error:', err);
        const errorMessage = err instanceof Error ? err.message : '';

        // Provide specific error messages based on error type
        if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission')) {
          setError(t('camera.permissionDenied') || 'Camera permission denied. Please allow camera access.');
        } else if (errorMessage.includes('NotFoundError')) {
          setError(t('camera.notFound') || 'No camera found on this device.');
        } else if (errorMessage.includes('NotReadableError') || errorMessage.includes('in use')) {
          setError(t('camera.inUse') || 'Camera is in use by another application.');
        } else {
          setError(t('camera.error') || 'Failed to access camera. Check permissions.');
        }
        setIsInitializing(false);
      }
    };

    // Delay to ensure DOM is ready (dialog animation takes ~300ms)
    const timer = setTimeout(initCamera, 350);
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [open, stopCamera, t]);

  // Take photo
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Convert to JPEG data URL (smaller file size than PNG)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);

    // Stop camera after capture
    stopCamera();
  };

  // Retake photo
  const handleRetake = async () => {
    setCapturedImage(null);

    try {
      setIsInitializing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsInitializing(false);
    } catch (err) {
      console.error('Camera restart error:', err);
      setError(t('camera.error') || 'Failed to restart camera.');
      setIsInitializing(false);
    }
  };

  // Confirm and use photo
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !left-0 !top-0 !right-0 !bottom-0 w-full !max-w-full !max-h-full !translate-x-0 !translate-y-0 p-0 gap-0 !rounded-none bg-black flex flex-col"
        style={{ height: '100dvh' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b border-stone-700 flex-row items-center justify-between bg-stone-900 shrink-0">
          <DialogTitle className="text-lg font-semibold text-white">{t('camera.title')}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 text-white hover:bg-stone-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative bg-black flex-1 flex items-center justify-center">
          {/* Live camera view */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
            playsInline
            muted
            autoPlay
          />

          {/* Captured image preview */}
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-contain bg-stone-900"
            />
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading state */}
          {isInitializing && !capturedImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-white text-sm">{t('camera.starting')}</p>
              </div>
            </div>
          )}

          {/* Error state */}
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

        {/* Action buttons */}
        <div className="px-4 py-4 bg-stone-900 border-t border-stone-700 flex gap-3 shrink-0">
          {!capturedImage ? (
            <Button
              onClick={handleCapture}
              disabled={isInitializing || !!error}
              className="flex-1 h-12 bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] text-white font-semibold"
            >
              <Camera className="w-5 h-5 mr-2" />
              {t('camera.capture')}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleRetake}
                variant="outline"
                className="flex-1 h-12 border-2 border-stone-300 font-semibold"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                {t('camera.retake')}
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 h-12 bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] text-white font-semibold"
              >
                <Check className="w-5 h-5 mr-2" />
                {t('camera.usePhoto')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCaptureDialog;
