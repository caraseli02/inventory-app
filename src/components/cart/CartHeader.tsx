import { useTranslation } from 'react-i18next';
import { ShoppingCartIcon } from '../ui/Icons';

interface CartHeaderProps {
  itemCount: number;
  total: number;
}

/**
 * Cart header displaying item count and total price with strong visual hierarchy
 * Enhanced with smooth animations and visual feedback
 */
export const CartHeader = ({ itemCount, total }: CartHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 flex items-center justify-between border-b-2 border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100/50 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white shadow-md transition-transform hover:scale-105">
          <ShoppingCartIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-stone-900">{t('cart.title')}</h3>
          <p className="text-sm text-stone-500 transition-all">
            <span className="inline-block transition-all">{itemCount}</span> {itemCount === 1 ? t('cart.item', 'item') : t('cart.items')}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-0.5">{t('cart.total')}</p>
        <p className="text-2xl font-bold text-stone-900 tabular-nums transition-all">
          €{total.toFixed(2)}
        </p>
      </div>
    </div>
  );
};
