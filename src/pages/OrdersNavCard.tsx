import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface OrdersNavCardProps {
  pendingOrderCount: number;
  onClick: () => void;
}

export function OrdersNavCard({ pendingOrderCount, onClick }: OrdersNavCardProps) {
  const { t } = useTranslation();
  const hasPending = pendingOrderCount > 0;

  return (
    <Card
      className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 sm:p-6 text-left transition hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 min-h-[180px] sm:min-h-[200px] ${
        hasPending ? 'border-[var(--color-lavender)] hover:border-[var(--color-lavender-dark)]' : 'border-stone-200 hover:border-stone-300'
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      {hasPending && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-[var(--color-lavender)] text-white px-2.5 py-1 rounded-full shadow-lg animate-pulse">
          <span className="text-xs font-bold">{pendingOrderCount}</span>
        </div>
      )}
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl group-hover:scale-110 transition-all ${
            hasPending
              ? 'bg-[var(--color-lavender)]/10 text-[var(--color-lavender)] group-hover:bg-[var(--color-lavender)]/20'
              : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'
          }`}>
            <MessageCircle className="h-6 w-6" />
          </div>
          <Badge variant="secondary" className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${
            hasPending
              ? 'bg-[var(--color-lavender)]/10 border-[var(--color-lavender)]/30 text-[var(--color-lavender)]'
              : 'bg-stone-100 border-stone-200'
          }`}>
            {hasPending ? t('orders.newOrders', 'New Orders!') : 'WhatsApp'}
          </Badge>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t('orders.pickupOrders', 'Pickup Orders')}</h2>
          <p className={`text-sm leading-snug ${hasPending ? 'text-[var(--color-lavender)]' : 'text-stone-500'}`}>
            {hasPending
              ? `${pendingOrderCount} order${pendingOrderCount !== 1 ? 's' : ''} waiting for confirmation`
              : t('orders.viaWhatsApp', 'Customer orders via WhatsApp')}
          </p>
        </div>
      </div>
    </Card>
  );
}
