import { useEffect, useState, type ReactNode } from 'react';
import ScanPage from './pages/ScanPage';
import CheckoutPage from './pages/CheckoutPage';
import OfflineIndicator from './components/OfflineIndicator';
import { MinusIcon, PlusIcon, ShoppingCartIcon } from './components/ui/Icons';

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
      const isNowTablet = event.matches;
      setIsTablet(isNowTablet);

      // When switching to mobile and currently on home, switch to scanner mode
      if (!isNowTablet && view === 'home') {
        setView(scannerMode);
      }
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [scannerMode, view]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(SCANNER_MODE_KEY, scannerMode);
  }, [scannerMode]);

  const handleScannerModeChange = (mode: Extract<ViewState, 'add' | 'remove'>) => {
    setScannerMode(mode);
    setView(mode);
  };

  const actions: Array<{
    key: Extract<ViewState, 'add' | 'remove'>;
    title: string;
    description: string;
    icon: ReactNode;
    onClick: () => void;
  }> = [
    {
      key: 'add' as const,
      title: 'Add Items',
      description: 'Receive inventory into stock',
      icon: <PlusIcon className="h-6 w-6" />,
      onClick: () => handleScannerModeChange('add'),
    },
    {
      key: 'remove' as const,
      title: 'Remove Items',
      description: 'Deplete inventory that was used',
      icon: <MinusIcon className="h-6 w-6" />,
      onClick: () => handleScannerModeChange('remove'),
    },
  ];

  return (
    <div className="min-h-dvh bg-white text-gray-900 p-4 lg:p-8 pb-0 font-inter selection:bg-gray-200">
      <OfflineIndicator />

      <header className="mb-12 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase font-semibold">Inventory Management</p>
          <h1 className="text-4xl font-light tracking-tight text-gray-900 mt-1">Grocery Inventory</h1>
        </div>
        <div className="flex items-center gap-3">
          {!isTablet && view !== 'checkout' && (
            <button
              onClick={() => setView('checkout')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Checkout
            </button>
          )}
          {isTablet && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
              Tablet mode
            </div>
          )}
        </div>
      </header>

      <main className="w-full px-0 lg:px-0 flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-5xl animate-in fade-in duration-300">
            <div className="grid gap-7 sm:grid-cols-2 lg:gap-8">
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={action.onClick}
                  className="group relative rounded-2xl border-2 border-gray-200 bg-white p-10 text-left transition hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                >
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition">
                        {action.icon}
                      </div>
                      <span className="inline-block rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold tracking-wider text-gray-600 uppercase">
                        {action.key === 'add' ? 'Inbound' : 'Outbound'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-xl font-bold text-gray-900">{action.title}</h2>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setView('checkout')}
                className="group relative rounded-2xl border-2 border-gray-200 bg-white p-10 text-left transition hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
              >
                <div className="flex h-full flex-col justify-between gap-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition">
                      <ShoppingCartIcon className="h-6 w-6" />
                    </div>
                    <span className="inline-block rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold tracking-wider text-gray-600 uppercase">
                      {isTablet ? 'Tablet' : 'Mobile'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold text-gray-900">Checkout Mode</h2>
                    <p className="text-sm text-gray-600">
                      Batch scan for payment with simplified mobile controls.
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
