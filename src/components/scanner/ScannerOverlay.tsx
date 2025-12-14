/**
 * Scanner overlay with corner guides to help users align barcodes
 * Matches the html5-qrcode library's 250x250 qrbox dimensions
 * Positioned absolutely over the scanner viewport
 */
export function ScannerOverlay() {
  // Match the qrbox size from Scanner.tsx config (250x250)
  const frameSize = 250;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Semi-transparent overlay with cutout for scan area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Dark overlay around scan area */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(0,0,0,0.4) 0%,
              rgba(0,0,0,0.2) 30%,
              rgba(0,0,0,0.2) 70%,
              rgba(0,0,0,0.4) 100%)`,
          }}
        />

        {/* Scan frame - matches qrbox 250x250 */}
        <div
          className="relative z-10"
          style={{ width: frameSize, height: frameSize }}
        >
          {/* Corner brackets - thick and prominent */}
          {/* Top-left */}
          <div className="absolute -top-0.5 -left-0.5">
            <div className="w-12 h-1.5 bg-[var(--color-forest)] rounded-full shadow-lg" />
            <div className="w-1.5 h-12 bg-[var(--color-forest)] rounded-full shadow-lg" />
          </div>
          {/* Top-right */}
          <div className="absolute -top-0.5 -right-0.5">
            <div className="w-12 h-1.5 bg-[var(--color-forest)] rounded-full shadow-lg absolute right-0" />
            <div className="w-1.5 h-12 bg-[var(--color-forest)] rounded-full shadow-lg absolute right-0" />
          </div>
          {/* Bottom-left */}
          <div className="absolute -bottom-0.5 -left-0.5">
            <div className="w-12 h-1.5 bg-[var(--color-forest)] rounded-full shadow-lg absolute bottom-0" />
            <div className="w-1.5 h-12 bg-[var(--color-forest)] rounded-full shadow-lg absolute bottom-0" />
          </div>
          {/* Bottom-right */}
          <div className="absolute -bottom-0.5 -right-0.5">
            <div className="w-12 h-1.5 bg-[var(--color-forest)] rounded-full shadow-lg absolute right-0 bottom-0" />
            <div className="w-1.5 h-12 bg-[var(--color-forest)] rounded-full shadow-lg absolute right-0 bottom-0" />
          </div>

          {/* Animated scan line */}
          <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 overflow-hidden h-16">
            <div
              className="h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent shadow-[0_0_8px_var(--color-forest)]"
              style={{
                animation: 'scanline 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* Scanning active indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
        <div className="w-2 h-2 bg-[var(--color-forest)] rounded-full animate-pulse shadow-[0_0_6px_var(--color-forest)]" />
        <span className="text-white text-xs font-medium">Scanning</span>
      </div>

      {/* CSS animation for scanline */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-30px); opacity: 0.5; }
          50% { transform: translateY(30px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
