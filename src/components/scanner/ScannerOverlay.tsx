type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const cornerPositionClasses: Record<CornerPosition, { container: string; horizontal: string; vertical: string }> = {
  'top-left': {
    container: 'absolute top-2 left-2 w-10 h-10',
    horizontal: 'absolute top-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full shadow-sm',
    vertical: 'absolute top-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full shadow-sm',
  },
  'top-right': {
    container: 'absolute top-2 right-2 w-10 h-10',
    horizontal: 'absolute top-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full shadow-sm',
    vertical: 'absolute top-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full shadow-sm',
  },
  'bottom-left': {
    container: 'absolute bottom-2 left-2 w-10 h-10',
    horizontal: 'absolute bottom-0 left-0 w-full h-1 bg-[var(--color-forest)] rounded-full shadow-sm',
    vertical: 'absolute bottom-0 left-0 h-full w-1 bg-[var(--color-forest)] rounded-full shadow-sm',
  },
  'bottom-right': {
    container: 'absolute bottom-2 right-2 w-10 h-10',
    horizontal: 'absolute bottom-0 right-0 w-full h-1 bg-[var(--color-forest)] rounded-full shadow-sm',
    vertical: 'absolute bottom-0 right-0 h-full w-1 bg-[var(--color-forest)] rounded-full shadow-sm',
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
      {/* Darkened edges for focus */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30" />

      {/* Scanning frame area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[280px] h-[200px]">
          {/* Corner brackets */}
          <CornerBracket position="top-left" />
          <CornerBracket position="top-right" />
          <CornerBracket position="bottom-left" />
          <CornerBracket position="bottom-right" />

          {/* Animated scan line */}
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2">
            <div
              className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent"
              style={{
                animation: 'scanline 2s ease-in-out infinite',
              }}
            />
          </div>

          {/* Center crosshair (subtle) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-px bg-white/30" />
            <div className="w-px h-6 bg-white/30 -mt-3 ml-[11.5px]" />
          </div>
        </div>
      </div>

      {/* Scanning active indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
        <div className="w-2 h-2 bg-[var(--color-forest)] rounded-full animate-pulse" />
        <span className="text-white/90 text-xs font-medium">Scanning</span>
      </div>

      {/* CSS animation for scanline */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-30px); opacity: 0.3; }
          50% { transform: translateY(30px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
