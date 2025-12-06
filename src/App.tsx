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

    if (!isTablet && view === 'home') {
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

  const actions = [
    {
      key: 'add' as const,
      title: 'Add Items',
      description: 'Receive inventory into stock',
      accent: 'from-emerald-500/20 to-emerald-900/20',
      icon: '+',
      onClick: () => handleScannerModeChange('add'),
    },
    {
      key: 'remove' as const,
      title: 'Remove Items',
      description: 'Deplete inventory that was used',
      accent: 'from-amber-500/20 to-orange-900/20',
      icon: '−',
      onClick: () => handleScannerModeChange('remove'),
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-2 lg:p-6 pb-0 font-inter selection:bg-blue-500/20">
      <OfflineIndicator />

      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Inventory Ops</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">Grocery Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isTablet && view !== 'checkout' && (
            <button
              onClick={() => setView('checkout')}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/50 bg-indigo-600/20 px-4 py-2 text-xs font-semibold text-indigo-100 shadow-sm transition hover:bg-indigo-500/30 hover:text-white"
            >
              🛒 Mobile checkout
            </button>
          )}
          {isTablet && (
            <div className="rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-sm text-slate-300 shadow-sm">
              Tablet layout — access Checkout from Home
            </div>
          )}
        </div>
      </header>

      <main className="w-full px-2 lg:px-0 flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-5xl space-y-6 animate-in slide-in-from-bottom-2 duration-500">
            <div className="grid gap-4 sm:grid-cols-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={action.onClick}
                  className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-left transition shadow-sm hover:border-slate-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.accent} opacity-70 transition group-hover:opacity-100`} />
                  <div className="relative flex h-full flex-col justify-between gap-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/90 text-2xl font-bold text-slate-100 shadow-inner">
                        {action.icon}
                      </div>
                      <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-300">
                        {action.key === 'add' ? 'Inbound' : 'Outbound'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-slate-50">{action.title}</h2>
                      <p className="text-sm text-slate-300">{action.description}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setView('checkout')}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-left transition shadow-sm hover:border-slate-700 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-900/25 opacity-70 transition group-hover:opacity-100" />
                <div className="relative flex h-full flex-col justify-between gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/90 text-2xl font-bold text-slate-100 shadow-inner">
                      🛒
                    </div>
                    <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-medium text-indigo-100">
                      {isTablet ? 'Tablet ready' : 'Mobile friendly' }
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-slate-50">Checkout Mode</h2>
                    <p className="text-sm text-slate-300">
                      Batch scan for payment with optimized mobile controls when needed.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : view === 'checkout' ? (
          <CheckoutPage onBack={() => setView(isTablet ? 'home' : scannerMode)} />
        ) : (
          <ScanPage
            mode={scannerMode}
            onBack={() => setView('home')}
            onModeChange={handleScannerModeChange}
            isTablet={isTablet}
            onCheckout={() => setView('checkout')}
          />
        )}

      </main>
    </div>
  );
}

export default App;
