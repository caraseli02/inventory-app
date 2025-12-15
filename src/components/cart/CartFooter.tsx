import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { CheckCircleIcon } from '../ui/Icons';

interface CartFooterProps {
  itemCount: number;
  total: number;
  isCheckingOut: boolean;
  onCheckout: () => void;
  checkoutComplete: boolean;
}

/**
 * Cart footer with checkout button and summary
 */
export const CartFooter = ({
  itemCount,
  total,
  isCheckingOut,
  onCheckout,
  checkoutComplete,
}: CartFooterProps) => {
  const { t } = useTranslation();

  return (
    <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <span className="text-stone-700 font-semibold">{t('cart.totalWithCount', { count: itemCount })}</span>
        <span
          className="text-2xl font-bold text-stone-900"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          €{total.toFixed(2)}
        </span>
      </div>

      {checkoutComplete ? (
        <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <CheckCircleIcon className="h-5 w-5" />
          <span className="font-semibold">{t('cart.checkoutComplete')}</span>
        </div>
      ) : (
        <Button
          className="w-full h-12 text-base font-semibold bg-stone-900 hover:bg-stone-800 text-white"
          onClick={onCheckout}
          disabled={itemCount === 0 || isCheckingOut}
        >
          {isCheckingOut ? t('cart.processing') : t('cart.checkout')}
        </Button>
      )}
    </div>
  );
};
