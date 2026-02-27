import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { AgentInbox } from '@/components/AgentInbox';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BoxIcon, ShoppingCartIcon } from '@/components/ui/Icons';
import { getOrders } from '@/lib/orders-api';
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts';
import { InventoryNavCard } from './InventoryNavCard';
import { OrdersNavCard } from './OrdersNavCard';

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lowStockCount, hasAlerts, error: lowStockError, isLoading: lowStockLoading } = useLowStockAlerts();
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => getOrders('pending'),
    staleTime: 1000 * 30,
  });
  const pendingOrderCount = pendingOrders.length;

  const go = useCallback((to: string) => {
    navigate(to);
  }, [navigate]);

  return (
    <div className="w-full max-w-5xl animate-in fade-in duration-300">
      <ErrorBoundary>
        <AgentInbox />
      </ErrorBoundary>

      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 md:grid-cols-3">
        <Card
          className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-6 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px]"
          onClick={() => go('/manage')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go('/manage');
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
              <p className="text-sm text-stone-500 leading-snug">{t('home.manageStock.description')}</p>
            </div>
          </div>
        </Card>

        <Card
          className="group relative cursor-pointer rounded-2xl border-2 border-stone-200 bg-white p-5 sm:p-6 text-left transition hover:border-stone-300 hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px]"
          onClick={() => go('/checkout')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go('/checkout');
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
              <p className="text-sm text-stone-500 leading-snug">{t('home.checkoutMode.description')}</p>
            </div>
          </div>
        </Card>

        <InventoryNavCard
          lowStockCount={lowStockCount}
          hasAlerts={hasAlerts}
          lowStockError={lowStockError}
          lowStockLoading={lowStockLoading}
          onClick={() => go('/inventory')}
        />

        <OrdersNavCard
          pendingOrderCount={pendingOrderCount}
          onClick={() => go('/orders')}
        />
      </div>
    </div>
  );
}
