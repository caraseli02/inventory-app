import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CartItem as CartItemType } from '../../types';
import { CartItem as CartItemComponent } from './CartItem';
import { CartHeader } from './CartHeader';
import { CartFooter } from './CartFooter';
import { ShoppingCartIcon } from '../ui/Icons';
import { Button } from '../ui/button';
import { ScanBarcode } from 'lucide-react';

interface CartProps {
  cart: CartItemType[];
  total: number;
  isCheckingOut?: boolean;
  checkoutComplete?: boolean;
  onUpdateQuantity: (index: number, delta: number) => void;
  onCheckout?: () => void;
  /** Optional custom footer content. If provided, replaces the default CartFooter */
  customFooter?: ReactNode;
  /** Optional callback for empty cart CTA (e.g., navigate to scanner) */
  onStartScanning?: () => void;
}

/**
 * Comprehensive cart component that displays cart header, items list, and checkout footer
 * Combines CartHeader, CartItem, and CartFooter components into a cohesive cart UI
 *
 * @param customFooter - Optional custom footer content to replace default CartFooter
 */
export const Cart = ({
  cart,
  total,
  isCheckingOut = false,
  checkoutComplete = false,
  onUpdateQuantity,
  onCheckout,
  customFooter,
  onStartScanning,
}: CartProps) => {
  const { t } = useTranslation();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* Cart Header */}
      <CartHeader itemCount={itemCount} total={total} />

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
            <ShoppingCartIcon className="h-16 w-16 text-stone-300 mb-4" />
            <p className="text-lg font-semibold text-stone-700 mb-1">{t('cart.empty', 'Cart is Empty')}</p>
            <p className="text-sm text-stone-500 mb-6">
              {t('cart.emptyHint', 'Scan products to add them to your cart')}
            </p>
            {onStartScanning && (
              <Button
                onClick={onStartScanning}
                className="bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white h-12 px-6"
                aria-label={t('cart.startScanning', 'Start scanning products')}
              >
                <ScanBarcode className="h-5 w-5 mr-2" />
                {t('cart.startScanning', 'Start Scanning')}
              </Button>
            )}
          </div>
        ) : (
          cart.map((item, index) => (
            <CartItemComponent
              key={`${item.product.id}-${index}`}
              item={item}
              index={index}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))
        )}
      </div>

      {/* Cart Footer */}
      {customFooter || (
        <CartFooter
          itemCount={itemCount}
          total={total}
          isCheckingOut={isCheckingOut}
          checkoutComplete={checkoutComplete}
          onCheckout={onCheckout!}
        />
      )}
    </>
  );
};
