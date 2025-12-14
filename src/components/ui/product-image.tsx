import { useState } from 'react';
import { Package, ImageOff, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showZoom?: boolean;
  aspectRatio?: '1:1' | '4:3' | '3:4';
}

const sizeClasses = {
  sm: 'w-14 h-14',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40',
};

const iconSizes = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

const aspectRatioClasses = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '3:4': 'aspect-[3/4]',
};

/**
 * Standardized product image component with consistent styling
 * - Fixed aspect ratio (default 1:1)
 * - Object-cover fill mode
 * - Centered placeholder when no image
 * - Optional zoom on click
 * - Error state handling
 */
export function ProductImage({
  src,
  alt,
  size = 'md',
  className,
  showZoom = false,
  aspectRatio = '1:1',
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset error state when src changes
  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const hasValidSrc = src && !hasError;

  const containerClasses = cn(
    'relative rounded-xl overflow-hidden border-2 border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center flex-shrink-0',
    aspectRatioClasses[aspectRatio],
    sizeClasses[size],
    showZoom && hasValidSrc && 'cursor-zoom-in group',
    className
  );

  const handleImageError = () => {
    logger.warn('ProductImage failed to load', {
      src: src?.substring(0, 100), // Truncate long URLs
      alt,
      size,
      timestamp: new Date().toISOString(),
    });
    setHasError(true);
  };

  const handleClick = () => {
    if (showZoom && hasValidSrc) {
      setIsZoomOpen(true);
    }
  };

  return (
    <>
      <div
        className={containerClasses}
        onClick={handleClick}
        role={showZoom && hasValidSrc ? 'button' : undefined}
        tabIndex={showZoom && hasValidSrc ? 0 : undefined}
        onKeyDown={(e) => {
          if (showZoom && hasValidSrc && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsZoomOpen(true);
          }
        }}
        aria-label={showZoom && hasValidSrc ? `View ${alt} full size` : undefined}
      >
        {hasValidSrc ? (
          <>
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
            {showZoom && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            )}
          </>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center text-stone-400 p-2">
            <ImageOff className={iconSizes[size]} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-stone-400">
            <Package className={iconSizes[size]} />
          </div>
        )}
      </div>

      {/* Zoom Dialog */}
      {showZoom && (
        <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>{alt}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center bg-stone-50 rounded-lg overflow-hidden">
              <img
                src={src || ''}
                alt={alt}
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
