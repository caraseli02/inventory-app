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
    <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-200">
      <div className="flex items-center gap-3">
        <ShoppingCartIcon className="h-6 w-6 text-stone-900" />
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t('cart.title')}</h3>
          <p className="text-sm text-gray-500">{itemCount} {t('cart.items')}</p>
        </div>
      </div>
      <div className="text-2xl font-bold text-stone-900">
        € {total.toFixed(2)}
      </div>
    </div>
  );
};
