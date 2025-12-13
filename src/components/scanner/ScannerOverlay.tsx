/**
 * Scanner overlay with corner guides to help users align barcodes
 * Positioned absolutely over the scanner viewport
 */
export const ScannerOverlay = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Semi-transparent overlay with cutout for scanning area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Scanning frame with corner brackets */}
        <div className="relative w-[250px] h-[250px]">
          {/* Corner brackets - Top Left */}
          <div className="absolute top-0 left-0 w-8 h-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full" />
            <div className="absolute top-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full" />
          </div>
          {/* Corner brackets - Top Right */}
          <div className="absolute top-0 right-0 w-8 h-8">
            <div className="absolute top-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full" />
            <div className="absolute top-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full" />
          </div>
          {/* Corner brackets - Bottom Left */}
          <div className="absolute bottom-0 left-0 w-8 h-8">
            <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full" />
            <div className="absolute bottom-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full" />
          </div>
          {/* Corner brackets - Bottom Right */}
          <div className="absolute bottom-0 right-0 w-8 h-8">
            <div className="absolute bottom-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full" />
            <div className="absolute bottom-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full" />
          </div>

          {/* Animated scan line */}
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};
