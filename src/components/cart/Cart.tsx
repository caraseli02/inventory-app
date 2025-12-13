import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CartItem as CartItemType } from '../../types';
import { CartItem as CartItemComponent } from './CartItem';
import { CartHeader } from './CartHeader';
import { CartFooter } from './CartFooter';
import { ShoppingCartIcon } from '../ui/Icons';

interface CartProps {
  cart: CartItemType[];
  total: number;
  isCheckingOut?: boolean;
  checkoutComplete?: boolean;
  onUpdateQuantity: (index: number, delta: number) => void;
  onCheckout?: () => void;
  /** Optional custom footer content. If provided, replaces the default CartFooter */
  customFooter?: ReactNode;
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
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <ShoppingCartIcon className="h-16 w-16 text-stone-300 mb-4" />
            <p className="text-stone-600 font-medium">{t('cart.empty')}</p>
            <p className="text-xs text-stone-400 mt-2">
              {t('cart.emptyHint', 'Scan products to add them to your cart')}
            </p>
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
