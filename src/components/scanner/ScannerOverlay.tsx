type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const cornerPositionClasses: Record<CornerPosition, { container: string; horizontal: string; vertical: string }> = {
  'top-left': {
    container: 'absolute top-0 left-0 w-8 h-8',
    horizontal: 'absolute top-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full',
    vertical: 'absolute top-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full',
  },
  'top-right': {
    container: 'absolute top-0 right-0 w-8 h-8',
    horizontal: 'absolute top-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full',
    vertical: 'absolute top-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full',
  },
  'bottom-left': {
    container: 'absolute bottom-0 left-0 w-8 h-8',
    horizontal: 'absolute bottom-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full',
    vertical: 'absolute bottom-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full',
  },
  'bottom-right': {
    container: 'absolute bottom-0 right-0 w-8 h-8',
    horizontal: 'absolute bottom-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full',
    vertical: 'absolute bottom-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full',
  },
};

function CornerBracket({ position }: { position: CornerPosition }) {
  const classes = cornerPositionClasses[position];
  return (
    <div className={classes.container}>
      <div className={classes.horizontal} />
      <div className={classes.vertical} />
    </div>
  );
}

/**
 * Scanner overlay with corner guides to help users align barcodes
 * Positioned absolutely over the scanner viewport
 */
export function ScannerOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[250px] h-[250px]">
          <CornerBracket position="top-left" />
          <CornerBracket position="top-right" />
          <CornerBracket position="bottom-left" />
          <CornerBracket position="bottom-right" />

          {/* Animated scan line */}
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
