/* eslint-disable react-refresh/only-export-components */
import { Suspense } from 'react';
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Spinner } from '@/components/ui/spinner';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import RootRouteError from '@/routes/RootRouteError';

const HomePage = lazyWithRetry(() => import('@/pages/HomePage'));
const ScanPage = lazyWithRetry(() => import('@/pages/ScanPage'));
const CheckoutPage = lazyWithRetry(() => import('@/pages/CheckoutPage'));
const InventoryListPage = lazyWithRetry(() => import('@/pages/InventoryListPage'));
const OrdersPage = lazyWithRetry(() => import('@/pages/OrdersPage'));

const LoadingFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Spinner size="lg" label={label} />
  </div>
);

function ManageRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback label={t('loading.scanner', 'Loading scanner...')} />}>
        <ScanPage onBack={() => navigate('/')} />
      </Suspense>
    </ErrorBoundary>
  );
}

function CheckoutRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback label={t('loading.checkout', 'Loading checkout...')} />}>
        <CheckoutPage onBack={() => navigate('/')} />
      </Suspense>
    </ErrorBoundary>
  );
}

function InventoryRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback label={t('loading.inventory', 'Loading inventory...')} />}>
        <InventoryListPage onBack={() => navigate('/')} />
      </Suspense>
    </ErrorBoundary>
  );
}

function OrdersRoute() {
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback label="Loading orders..." />}>
        <OrdersPage onBack={() => navigate('/')} />
      </Suspense>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RootRouteError />,
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback label="Loading..." />}>
              <HomePage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      { path: 'manage', element: <ManageRoute /> },
      { path: 'checkout', element: <CheckoutRoute /> },
      { path: 'inventory', element: <InventoryRoute /> },
      { path: 'orders', element: <OrdersRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
