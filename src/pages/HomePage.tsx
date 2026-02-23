import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { AgentInbox } from '@/components/AgentInbox';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BoxIcon, ListIcon, ShoppingCartIcon } from '@/components/ui/Icons';
import { getOrders } from '@/lib/orders-api';
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts';

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
      {/* AGENT INBOX INTEGRATION */}
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
            if (e.key === 'Enter' || e.key === ' ') {
              go('/manage');
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
          onClick={() => go('/checkout')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              go('/checkout');
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
          className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 sm:p-6 text-left transition hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 sm:col-span-2 md:col-span-1 min-h-[180px] sm:min-h-[200px] ${lowStockError
            ? 'border-stone-400 hover:border-stone-500'
            : hasAlerts
              ? 'border-[var(--color-terracotta)] hover:border-[var(--color-terracotta-dark)]'
              : 'border-stone-200 hover:border-stone-300'
            }`}
          onClick={() => go('/inventory')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              go('/inventory');
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
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl group-hover:scale-110 transition-all ${lowStockError
                  ? 'bg-stone-200 text-stone-500 group-hover:bg-stone-300'
                  : hasAlerts
                    ? 'bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)] group-hover:bg-[var(--color-terracotta)]/20'
                    : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'
                  }`}
              >
                <ListIcon className="h-6 w-6" />
              </div>
              <Badge
                variant="secondary"
                className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${lowStockError
                  ? 'bg-stone-200 border-stone-300 text-stone-600'
                  : hasAlerts
                    ? 'bg-[var(--color-terracotta)]/10 border-[var(--color-terracotta)]/30 text-[var(--color-terracotta)]'
                    : 'bg-stone-100 border-stone-200'
                  }`}
              >
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
              <p
                className={`text-sm leading-snug ${lowStockError
                  ? 'text-stone-500'
                  : hasAlerts
                    ? 'text-[var(--color-terracotta)]'
                    : 'text-stone-500'
                  }`}
              >
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

        {/* WhatsApp Pickup Orders */}
        <Card
          className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 sm:p-6 text-left transition hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px] ${
            pendingOrderCount > 0
              ? 'border-[var(--color-lavender)] hover:border-[var(--color-lavender-dark)]'
              : 'border-stone-200 hover:border-stone-300'
          }`}
          onClick={() => go('/orders')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') go('/orders');
          }}
        >
          {pendingOrderCount > 0 && (
            <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-[var(--color-lavender)] text-white px-2.5 py-1 rounded-full shadow-lg animate-pulse">
              <span className="text-xs font-bold">{pendingOrderCount}</span>
            </div>
          )}
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl group-hover:scale-110 transition-all ${
                pendingOrderCount > 0
                  ? 'bg-[var(--color-lavender)]/10 text-[var(--color-lavender)] group-hover:bg-[var(--color-lavender)]/20'
                  : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'
              }`}>
                <MessageCircle className="h-6 w-6" />
              </div>
              <Badge variant="secondary" className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
                pendingOrderCount > 0
                  ? 'bg-[var(--color-lavender)]/10 border-[var(--color-lavender)]/30 text-[var(--color-lavender)]'
                  : 'bg-stone-100 border-stone-200'
              }`}>
                {pendingOrderCount > 0 ? 'New Orders!' : 'WhatsApp'}
              </Badge>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900">Pickup Orders</h2>
              <p className={`text-sm leading-snug ${pendingOrderCount > 0 ? 'text-[var(--color-lavender)]' : 'text-stone-500'}`}>
                {pendingOrderCount > 0
                  ? `${pendingOrderCount} order${pendingOrderCount !== 1 ? 's' : ''} waiting for confirmation`
                  : 'Customer orders via WhatsApp'
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

