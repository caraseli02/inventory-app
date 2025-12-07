import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react';
import OfflineIndicator from './components/OfflineIndicator';
import { Toaster } from 'sonner';
import { MinusIcon, PlusIcon, ShoppingCartIcon } from './components/ui/Icons';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Spinner } from './components/ui/spinner';
import { ErrorBoundary } from './components/ErrorBoundary';

// Route-based code splitting: lazy load pages with retry on failure
const retryLazyImport = (
  importFn: () => Promise<any>,
  retriesLeft = 3,
  interval = 1000
): Promise<any> => {
  return importFn().catch((error) => {
    if (retriesLeft === 0) {
      // If all retries failed, force reload to get fresh chunks
      console.error('Chunk load failed after retries. Reloading page...', error);
      window.location.reload();
      throw error;
    }

    console.warn(`Chunk load failed. Retrying... (${retriesLeft} attempts left)`, error);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(retryLazyImport(importFn, retriesLeft - 1, interval));
      }, interval);
    });
  });
};

const ScanPage = lazy(() => retryLazyImport(() => import('./pages/ScanPage')));
const CheckoutPage = lazy(() => retryLazyImport(() => import('./pages/CheckoutPage')));

// Loading fallback component for lazy-loaded pages
const LoadingFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Spinner size="lg" label={label} />
  </div>
);

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
  const [view, setView] = useState<ViewState>('home');

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
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
    <>
      <Toaster position="top-center" richColors closeButton expand={false} />
      <div className="min-h-dvh bg-[var(--color-cream)] text-stone-900 p-4 lg:p-8 pb-0 selection:bg-stone-200">
        <OfflineIndicator />

      <header className="mb-6 lg:mb-12 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="text-xs tracking-widest text-stone-400 uppercase font-bold bg-stone-50 border-stone-200 mb-2">
            Inventory Management
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900">Grocery Inventory</h1>
        </div>
        <div className="flex items-center gap-3">
          {isTablet && (
            <Badge variant="secondary" className="bg-stone-100 border-stone-200">
              Tablet mode
            </Badge>
          )}
        </div>
      </header>

      <main className="w-full px-0 lg:px-0 flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-5xl animate-in fade-in duration-300">
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:gap-8">
              {actions.map((action) => (
                <Card
                  key={action.key}
                  className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-8 lg:p-10 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                  onClick={action.onClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      action.onClick();
                    }
                  }}
                >
                  <div className="flex h-full flex-col justify-between gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-stone-100 text-stone-600 group-hover:bg-stone-200 group-hover:scale-110 transition-all shadow-sm">
                        {action.icon}
                      </div>
                      <Badge variant="secondary" className="bg-stone-100 border-stone-200 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-bold tracking-wider uppercase">
                        {action.key === 'add' ? 'Inbound' : 'Outbound'}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 lg:space-y-3">
                      <h2 className="text-xl sm:text-xl lg:text-2xl font-bold text-stone-900">{action.title}</h2>
                      <p className="text-xs sm:text-sm text-stone-600 font-medium">{action.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
              <Card
                className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-8 lg:p-10 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                onClick={() => setView('checkout')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setView('checkout');
                  }
                }}
              >
                <div className="flex h-full flex-col justify-between gap-4 sm:gap-6 lg:gap-8">
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-stone-100 text-stone-600 group-hover:bg-stone-200 group-hover:scale-110 transition-all shadow-sm">
                      <ShoppingCartIcon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="bg-stone-100 border-stone-200 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-bold tracking-wider uppercase">
                      {isTablet ? 'Tablet' : 'Mobile'}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 lg:space-y-3">
                    <h2 className="text-xl sm:text-xl lg:text-2xl font-bold text-stone-900">Checkout Mode</h2>
                    <p className="text-xs sm:text-sm text-stone-600 font-medium">
                      Batch scan for payment with simplified mobile controls.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : view === 'checkout' ? (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label="Loading checkout..." />}>
              <CheckoutPage onBack={() => setView('home')} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label="Loading scanner..." />}>
              <ScanPage
                mode={scannerMode}
                onBack={() => setView('home')}
                onModeChange={handleScannerModeChange}
              />
            </Suspense>
          </ErrorBoundary>
        )}

      </main>
      </div>
    </>
  );
}

export default App;
