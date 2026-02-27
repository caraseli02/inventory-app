import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ListIcon } from '@/components/ui/Icons';

interface InventoryNavCardProps {
  lowStockCount: number;
  hasAlerts: boolean;
  lowStockError: Error | null;
  lowStockLoading: boolean;
  onClick: () => void;
}

interface InventoryCardStatus {
  cardBorder: string;
  iconClass: string;
  badgeClass: string;
  descClass: string;
  showAlertBadge: boolean;
  showErrorBadge: boolean;
}

function getCardStatus(error: Error | null, hasAlerts: boolean): InventoryCardStatus {
  if (error) {
    return {
      cardBorder: 'border-stone-400 hover:border-stone-500',
      iconClass: 'bg-stone-200 text-stone-500 group-hover:bg-stone-300',
      badgeClass: 'bg-stone-200 border-stone-300 text-stone-600',
      descClass: 'text-stone-500',
      showAlertBadge: false,
      showErrorBadge: true,
    };
  }
  if (hasAlerts) {
    return {
      cardBorder: 'border-[var(--color-terracotta)] hover:border-[var(--color-terracotta-dark)]',
      iconClass: 'bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)] group-hover:bg-[var(--color-terracotta)]/20',
      badgeClass: 'bg-[var(--color-terracotta)]/10 border-[var(--color-terracotta)]/30 text-[var(--color-terracotta)]',
      descClass: 'text-[var(--color-terracotta)]',
      showAlertBadge: true,
      showErrorBadge: false,
    };
  }
  return {
    cardBorder: 'border-stone-200 hover:border-stone-300',
    iconClass: 'bg-stone-100 text-stone-600 group-hover:bg-stone-200',
    badgeClass: 'bg-stone-100 border-stone-200',
    descClass: 'text-stone-500',
    showAlertBadge: false,
    showErrorBadge: false,
  };
}

export function InventoryNavCard({ lowStockCount, hasAlerts, lowStockError, lowStockLoading, onClick }: InventoryNavCardProps) {
  const { t } = useTranslation();
  const status = getCardStatus(lowStockError, hasAlerts);

  const badgeText = lowStockError
    ? t('home.viewInventory.errorBadge', 'Error')
    : hasAlerts
      ? t('home.viewInventory.alertBadge', 'Low Stock!')
      : t('home.viewInventory.badge');

  const descText = lowStockError
    ? t('alerts.loadError', 'Unable to check stock levels')
    : hasAlerts
      ? t('home.viewInventory.alertDescription', '{{count}} items need reordering', { count: lowStockCount })
      : t('home.viewInventory.description');

  return (
    <Card
      className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 sm:p-6 text-left transition hover:shadow-xl hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 sm:col-span-2 md:col-span-1 min-h-[180px] sm:min-h-[200px] ${status.cardBorder}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      {status.showAlertBadge && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-[var(--color-terracotta)] text-white px-2.5 py-1 rounded-full shadow-lg animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">{lowStockCount}</span>
        </div>
      )}
      {status.showErrorBadge && !lowStockLoading && (
        <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1 bg-stone-600 text-white px-2.5 py-1 rounded-full shadow-lg">
          <span className="text-xs font-bold">!</span>
        </div>
      )}

      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl group-hover:scale-110 transition-all ${status.iconClass}`}>
            <ListIcon className="h-6 w-6" />
          </div>
          <Badge variant="secondary" className={`px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${status.badgeClass}`}>
            {badgeText}
          </Badge>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900">{t('home.viewInventory.title')}</h2>
          <p className={`text-sm leading-snug ${status.descClass}`}>{descText}</p>
        </div>
      </div>
    </Card>
  );
}
