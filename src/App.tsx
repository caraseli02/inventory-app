import { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import OfflineIndicator from './components/OfflineIndicator';
import { ToastProvider } from './hooks/useToast';
import { Toaster } from 'sonner';
import { BoxIcon, ShoppingCartIcon, ListIcon } from './components/ui/Icons';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Spinner } from './components/ui/spinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLowStockAlerts } from './hooks/useLowStockAlerts';
import { AlertTriangle } from 'lucide-react';

// Route-based code splitting: lazy load pages with retry on failure
const retryLazyImport = <T,>(
  importFn: () => Promise<T>,
  retriesLeft = 3,
  interval = 1000
): Promise<T> => {
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
const InventoryListPage = lazy(() => retryLazyImport(() => import('./pages/InventoryListPage')));

// Loading fallback component for lazy-loaded pages
const LoadingFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Spinner size="lg" label={label} />
  </div>
);

type ViewState = 'home' | 'manage' | 'checkout' | 'inventory';

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewState>('home');
  const { lowStockCount, hasAlerts, error: lowStockError, isLoading: lowStockLoading } = useLowStockAlerts();

  return (
    <ToastProvider>
      <>
        <Toaster position="top-center" richColors closeButton expand={false} />
        <div className="min-h-dvh bg-[var(--color-cream)] text-stone-900 p-4 lg:p-8 pb-0 selection:bg-stone-200">
          <OfflineIndicator />

      <header className="mb-6 lg:mb-8 max-w-5xl mx-auto">
        <Badge variant="outline" className="text-xs tracking-widest text-stone-400 uppercase font-bold bg-stone-50 border-stone-200 mb-2">
          {t('app.subtitle')}
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900">{t('app.title')}</h1>
      </header>

      <main className="w-full flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-5xl animate-in fade-in duration-300">
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 md:grid-cols-3">
              <Card
                className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-6 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px]"
                onClick={() => setView('manage')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setView('manage');
                  }
                }}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-600 group-hover:bg-stone-200 group-hover:scale-110 transition-all">
                      <BoxIcon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="bg-stone-100 border-stone-200 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
                      {t('home.manageStock.badge')}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t('home.manageStock.title')}</h2>
                    <p className="text-sm text-stone-500 leading-snug">
                      {t('home.manageStock.description')}
                    </p>
                  </div>
                </div>
              </Card>
              <Card
                className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-6 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px]"
                onClick={() => setView('checkout')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setView('checkout');
                  }
                }}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-600 group-hover:bg-stone-200 group-hover:scale-110 transition-all">
                      <ShoppingCartIcon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="bg-stone-100 border-stone-200 px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
                      {t('home.checkoutMode.badge')}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t('home.checkoutMode.title')}</h2>
                    <p className="text-sm text-stone-500 leading-snug">
                      {t('home.checkoutMode.description')}
                    </p>
                  </div>
                </div>
              </Card>
              <Card
                className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 sm:p-6 text-left transition hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 sm:col-span-2 md:col-span-1 min-h-[180px] sm:min-h-[200px] ${
                  lowStockError
                    ? 'border-stone-400 hover:border-stone-500'
                    : hasAlerts
                    ? 'border-[var(--color-terracotta)] hover:border-[var(--color-terracotta-dark)]'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
                onClick={() => setView('inventory')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setView('inventory');
                  }
                }}
              >
                {/* Low Stock Alert Badge */}
                {hasAlerts && !lowStockError && (
                  <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-[var(--color-terracotta)] text-white px-2.5 py-1 rounded-full shadow-lg animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">{lowStockCount}</span>
                  </div>
                )}
                {/* Error indicator when alerts couldn't be loaded */}
                {lowStockError && !lowStockLoading && (
                  <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-stone-600 text-white px-2.5 py-1 rounded-full shadow-lg">
                    <span className="text-xs font-bold">!</span>
                  </div>
                )}
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl group-hover:scale-110 transition-all ${
                      lowStockError
                        ? 'bg-stone-200 text-stone-500 group-hover:bg-stone-300'
                        : hasAlerts
                        ? 'bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)] group-hover:bg-[var(--color-terracotta)]/20'
                        : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'
                    }`}>
                      <ListIcon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
                      lowStockError
                        ? 'bg-stone-200 border-stone-300 text-stone-600'
                        : hasAlerts
                        ? 'bg-[var(--color-terracotta)]/10 border-[var(--color-terracotta)]/30 text-[var(--color-terracotta)]'
                        : 'bg-stone-100 border-stone-200'
                    }`}>
                      {lowStockError
                        ? t('home.viewInventory.errorBadge', 'Error')
                        : hasAlerts
                        ? t('home.viewInventory.alertBadge', 'Low Stock!')
                        : t('home.viewInventory.badge')
                      }
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t('home.viewInventory.title')}</h2>
                    <p className={`text-sm leading-snug ${
                      lowStockError
                        ? 'text-stone-500'
                        : hasAlerts
                        ? 'text-[var(--color-terracotta)]'
                        : 'text-stone-500'
                    }`}>
                      {lowStockError
                        ? t('alerts.loadError', 'Unable to check stock levels')
                        : hasAlerts
                        ? t('home.viewInventory.alertDescription', '{{count}} items need reordering', { count: lowStockCount })
                        : t('home.viewInventory.description')
                      }
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : view === 'checkout' ? (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label={t('loading.checkout')} />}>
              <CheckoutPage onBack={() => setView('home')} />
            </Suspense>
          </ErrorBoundary>
        ) : view === 'inventory' ? (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label={t('loading.inventory')} />}>
              <InventoryListPage onBack={() => setView('home')} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label={t('loading.scanner')} />}>
              <ScanPage onBack={() => setView('home')} />
            </Suspense>
          </ErrorBoundary>
        )}

      </main>
      </div>
    </>
    </ToastProvider>
  );
}

export default App;
