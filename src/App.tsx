import { useEffect, useState } from 'react';
import ScanPage from './pages/ScanPage';
import CheckoutPage from './pages/CheckoutPage';
import OfflineIndicator from './components/OfflineIndicator';

type ViewState = 'home' | 'add' | 'remove' | 'checkout';

const SCANNER_MODE_KEY = 'scannerMode';

const getStoredScannerMode = (): Extract<ViewState, 'add' | 'remove'> => {
  if (typeof window === 'undefined') return 'add';

  const storedMode = window.localStorage.getItem(SCANNER_MODE_KEY);
  return storedMode === 'remove' ? 'remove' : 'add';
};

function App() {
  const [scannerMode, setScannerMode] = useState<Extract<ViewState, 'add' | 'remove'>>(() => {
    return getStoredScannerMode();
  });
  const [view, setView] = useState<ViewState>(() => {
    if (typeof window === 'undefined') return 'home';

    const isTabletViewport = window.matchMedia('(min-width: 768px)').matches;
    if (isTabletViewport) return 'home';

    return getStoredScannerMode();
  });

  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsTablet(event.matches);
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isTablet && view !== 'home') {
      setView('home');
    }

    if (!isTablet && view === 'home') {
      setView(scannerMode);
    }

    if (!isTablet && view === 'checkout') {
      setView(scannerMode);
    }
  }, [isTablet, view, scannerMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(SCANNER_MODE_KEY, scannerMode);
  }, [scannerMode]);

  const handleScannerModeChange = (mode: Extract<ViewState, 'add' | 'remove'>) => {
    setScannerMode(mode);
    setView(mode);
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-2 lg:p-4 pb-0 font-inter selection:bg-blue-500/30">
      <OfflineIndicator />

      {/* Header */}
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Grocery Inventory
        </h1>
      </header>

      <main className="w-full px-4 flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <p className="text-slate-400">Select an action to begin</p>
            </div>

            <button
              onClick={() => handleScannerModeChange('add')}
              className="w-full aspect-[4/3] bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 rounded-2xl shadow-2xl border border-emerald-500/30 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform">
                +
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Add Items</h2>
                <p className="text-emerald-100/70 text-sm">Check-in new stock</p>
              </div>
            </button>

            <button
              onClick={() => handleScannerModeChange('remove')}
              className="w-full aspect-[4/3] bg-gradient-to-br from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 rounded-2xl shadow-2xl border border-red-500/30 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform">
                -
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Remove Items</h2>
                <p className="text-red-100/70 text-sm">Check-out used stock</p>
              </div>
            </button>

            {isTablet && (
              <button
                onClick={() => setView('checkout')}
                className="w-full aspect-[4/3] bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 rounded-2xl shadow-2xl border border-purple-500/30 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
              >
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-4xl mb-2 group-hover:scale-110 transition-transform">
                  🛒
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white">Checkout Mode</h2>
                  <p className="text-purple-100/70 text-sm">Scan multiple items & Pay</p>
                </div>
              </button>
            )}
          </div>
        ) : view === 'checkout' ? (
          <CheckoutPage onBack={() => setView('home')} />
        ) : (
          <ScanPage mode={scannerMode} onBack={() => setView('home')} onModeChange={handleScannerModeChange} />
        )}

      </main>
    </div>
  )
}

export default App
