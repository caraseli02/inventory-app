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
 * Comprehensive cart component that displays cart header, items list, and checkout footer.
 * Combines CartHeader, CartItem, and CartFooter components into a cohesive cart UI.
 *
 * Renders two distinct states:
 * - Empty state: Animated icon, empty message, and optional "Start Scanning" CTA
 * - Active state: Scrollable list of cart items with quantity controls
 *
 * @param customFooter - Optional custom footer content to replace default CartFooter
 * @param onStartScanning - Optional callback for empty state CTA (e.g., navigate to scanner)
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
          <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4 animate-fade-in">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-100 rounded-full blur-2xl opacity-30 animate-pulse"></div>
              <div className="relative bg-stone-100 rounded-full p-6 border-2 border-stone-200">
                <ShoppingCartIcon className="h-16 w-16 text-stone-400" />
              </div>
            </div>
            <p className="text-xl font-bold text-stone-800 mb-2">{t('cart.empty', 'Cart is Empty')}</p>
            <p className="text-sm text-stone-500 mb-8 max-w-xs">
              {t('cart.emptyHint', 'Scan products to add them to your cart')}
            </p>
            {onStartScanning && (
              <Button
                onClick={() => {
                  try {
                    onStartScanning();
                  } catch (error) {
                    console.error('Failed to start scanning from empty cart:', error);
                  }
                }}
                className="bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white h-12 px-8 rounded-xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95 animate-ripple"
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
