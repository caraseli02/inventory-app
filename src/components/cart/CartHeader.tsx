import { useTranslation } from 'react-i18next';
import { ShoppingCartIcon } from '../ui/Icons';

interface CartHeaderProps {
  itemCount: number;
  total: number;
}

/**
 * Cart header displaying item count and total price
 */
export const CartHeader = ({ itemCount, total }: CartHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="p-6 pb-4 flex items-center justify-between border-b-2 border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100/50">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white shadow-md">
          <ShoppingCartIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-stone-900">{t('cart.title')}</h3>
          <p className="text-sm text-stone-600 font-medium">{itemCount} {t('cart.items')}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-0.5">{t('cart.total')}</p>
        <p className="text-3xl font-bold text-[var(--color-forest)]">
          €{total.toFixed(2)}
        </p>
      </div>
    </div>
  );
};
