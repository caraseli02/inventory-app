import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/types';

interface MobileCartBarProps {
  /** Cart items */
  cart: CartItem[];
  /** Total price */
  total: number;
  /** Name of the last added product for feedback */
  lastAddedProduct?: string | null;
  /** Called when user wants to view full cart */
  onViewCart: () => void;
  /** Whether checkout is in progress */
  isCheckingOut?: boolean;
}

/**
 * Persistent cart bar for mobile checkout.
 * Appears at bottom of screen when cart has items.
 * Shows item count, total, last added product with thumbnail, and view cart button.
 * Enhanced with micro-animations and visual feedback.
 */
export const MobileCartBar = ({
  cart,
  total,
  lastAddedProduct,
  onViewCart,
  isCheckingOut = false,
}: MobileCartBarProps) => {
  const { t } = useTranslation();
  const [showLastAdded, setShowLastAdded] = useState(false);
  const [displayedLastAdded, setDisplayedLastAdded] = useState<string | null>(null);
  const [lastAddedImage, setLastAddedImage] = useState<string | null>(null);
  const [animateBadge, setAnimateBadge] = useState(false);

  // Calculate pending items (not yet checked out)
  const pendingItems = cart.filter(item => item.status !== 'success');
  const itemCount = pendingItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = itemCount > 0;

  // Handle last added product animation
  useEffect(() => {
    if (lastAddedProduct) {
      // Find the product in cart to get its image
      const addedProduct = cart.find(item => item.product.fields.Name === lastAddedProduct);
      const imageUrl = addedProduct?.product.fields.Image?.[0]?.url;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedLastAdded(lastAddedProduct);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastAddedImage(imageUrl || null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowLastAdded(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimateBadge(true);

      const badgeTimer = setTimeout(() => {
        setAnimateBadge(false);
      }, 500);

      const timer = setTimeout(() => {
        setShowLastAdded(false);
      }, 3000);

      return () => {
        clearTimeout(timer);
        clearTimeout(badgeTimer);
      };
    }
  }, [lastAddedProduct, cart]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      {/* Main bar - Always visible */}
      <div className={`bg-stone-900 text-white px-4 py-3 rounded-t-2xl shadow-2xl transition-all duration-300 ${hasItems ? 'animate-slide-in-up' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          {/* Left side: Count and last added */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className={`h-5 w-5 transition-colors ${hasItems ? 'text-emerald-400' : 'text-stone-500'}`} />
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full transition-all ${hasItems ? 'bg-emerald-500 text-white' : 'bg-stone-700 text-stone-400'} ${animateBadge ? 'animate-bounce-once' : ''}`}>
                {itemCount} {itemCount === 1 ? t('cart.item', 'item') : t('cart.items', 'items')}
              </span>
            </div>

            {/* Last added feedback with thumbnail - Only show when items exist */}
            {hasItems && (
              <div className="h-7 mt-1.5 overflow-hidden">
                <div
                  className={`
                    flex items-center gap-2
                    transition-all duration-300 ease-out
                    ${showLastAdded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}
                  `}
                >
                  {lastAddedImage && (
                    <div className="w-6 h-6 rounded bg-stone-800 overflow-hidden shrink-0 border border-emerald-500">
                      <img
                        src={lastAddedImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {!lastAddedImage && showLastAdded && (
                    <div className="w-6 h-6 rounded bg-stone-800 flex items-center justify-center shrink-0 border border-emerald-500">
                      <span className="text-[10px]">📦</span>
                    </div>
                  )}
                  <p className="text-sm text-emerald-400 font-medium truncate">
                    {displayedLastAdded && `+ ${displayedLastAdded}`}
                  </p>
                </div>
              </div>
            )}

            {/* Empty state hint - Only show when cart is empty */}
            {!hasItems && (
              <div className="h-5 mt-1 overflow-hidden">
                <p className="text-xs text-stone-500">
                  {t('cart.emptyHint', 'Scan products to add them to your cart')}
                </p>
              </div>
            )}
          </div>

          {/* Center: Total */}
          <div className="text-right">
            <p className="text-xs text-stone-400 uppercase tracking-wide">
              {t('cart.total', 'Total')}
            </p>
            <p className={`text-2xl font-bold tabular-nums transition-colors ${hasItems ? 'text-white' : 'text-stone-500'}`}>
              €{total.toFixed(2)}
            </p>
          </div>

          {/* Right: View Cart button */}
          <Button
            onClick={onViewCart}
            disabled={!hasItems || isCheckingOut}
            className={`font-bold px-5 py-6 rounded-xl flex items-center gap-2 transition-all ${hasItems ? 'bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 active:scale-95' : 'bg-stone-700 text-stone-500 cursor-not-allowed opacity-50'}`}
          >
            <span>{t('cart.viewCart', 'View Cart')}</span>
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
