import { useTranslation } from 'react-i18next';
import type { CartItem as CartItemType } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BoxIcon, CheckCircleIcon, TrashIcon } from '../ui/Icons';
import { Spinner } from '../ui/spinner';
import { Minus, Plus } from 'lucide-react';

interface CartItemProps {
  item: CartItemType;
  index: number;
  onUpdateQuantity: (index: number, delta: number) => void;
}

/**
 * Helper function to get status-based styling
 */
function getStatusStyles(status: CartItemType['status']): string {
  switch (status) {
    case 'failed':
      return 'border-red-200 bg-red-50/30';
    case 'success':
      return 'border-green-200 bg-green-50/30';
    default:
      return 'border-stone-200 hover:border-stone-300 hover:shadow-md';
  }
}

/**
 * Enhanced cart item with category badges, hover effects, and status indicators.
 * Touch-optimized: 44px touch targets on mobile (< 640px), 40px on tablet/desktop.
 * Note: Desktop buttons are below WCAG 2.5.5 minimum; acceptable as mouse-driven.
 */
export const CartItem = ({ item, index, onUpdateQuantity }: CartItemProps) => {
  const { t } = useTranslation();
  const imageUrl = item.product.fields.Image?.[0]?.url;
  const price = item.product.fields.Price;
  const category = item.product.fields.Category ? t(`categories.${item.product.fields.Category}`) : t('categories.General');
  const { status, statusMessage } = item;
  const isProcessing = status === 'processing';

  return (
    <div className={`bg-white border-2 rounded-xl overflow-hidden transition-all duration-200 animate-scale-in ${getStatusStyles(status)}`}>
      <div className="flex gap-0 items-stretch">
        <div className="w-24 min-h-[96px] bg-stone-100 flex items-center justify-center shrink-0 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.product.fields.Name}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.warn('Failed to load product image in cart:', imageUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <BoxIcon className="h-10 w-10 text-stone-400" />
          )}
        </div>

        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div className="flex-1">
            <h3 className="font-semibold text-stone-900 text-sm leading-tight line-clamp-2 mb-1">
              {item.product.fields.Name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs bg-stone-100 text-stone-600 hover:bg-stone-100 px-1.5 py-0">
                {category}
              </Badge>
              {price != null && (
                <span className="text-xs font-semibold text-[var(--color-forest)]">
                  €{price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  try {
                    onUpdateQuantity(index, -1);
                  } catch (error) {
                    console.error('Failed to decrease cart item quantity:', error);
                  }
                }}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg bg-white border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 transition-all hover:scale-105 active:scale-95 touch-feedback"
                disabled={isProcessing}
                aria-label={t('cart.decreaseQuantityFor', {
                  name: item.product.fields.Name,
                  defaultValue: `Decrease quantity for ${item.product.fields.Name}`,
                })}
              >
                <Minus className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>

              <span
                className="font-bold text-lg min-w-[2.5rem] text-center tabular-nums transition-all"
                aria-label={t('cart.quantityLabel', {
                  quantity: item.quantity,
                  defaultValue: `Quantity: ${item.quantity}`,
                })}
              >
                {item.quantity}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  try {
                    onUpdateQuantity(index, 1);
                  } catch (error) {
                    console.error('Failed to increase cart item quantity:', error);
                  }
                }}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg bg-white border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 transition-all hover:scale-105 active:scale-95 touch-feedback"
                disabled={isProcessing}
                aria-label={t('cart.increaseQuantityFor', {
                  name: item.product.fields.Name,
                  defaultValue: `Increase quantity for ${item.product.fields.Name}`,
                })}
              >
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {price != null && (
                <span className="font-bold text-stone-900 text-base tabular-nums">
                  €{(price * item.quantity).toFixed(2)}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  try {
                    onUpdateQuantity(index, -item.quantity);
                  } catch (error) {
                    console.error('Failed to remove cart item:', error);
                  }
                }}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg text-stone-400 hover:text-[var(--color-terracotta)] hover:bg-red-50 transition-all hover:scale-110 active:scale-95 touch-feedback"
                disabled={isProcessing}
                aria-label={t('cart.removeItemFor', {
                  name: item.product.fields.Name,
                  defaultValue: `Remove ${item.product.fields.Name} from cart`,
                })}
              >
                <TrashIcon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {status === 'processing' && (
        <div className="px-3 pb-3 flex items-center gap-2 text-sm text-[var(--color-lavender)] bg-[var(--color-lavender)]/5 border-t border-[var(--color-lavender)]/20">
          <Spinner size="sm" />
          <span className="font-medium">{t('cart.processing')}</span>
        </div>
      )}
      {status === 'failed' && statusMessage && (
        <div className="px-3 pb-3 pt-2 border-t border-red-200">
          <div className="text-sm text-red-700 bg-red-100/50 rounded-lg p-2">
            {statusMessage}
          </div>
        </div>
      )}
      {status === 'success' && (
        <div className="px-3 pb-2 pt-1 flex items-center gap-2 text-sm text-green-700 border-t border-green-200">
          <CheckCircleIcon className="h-4 w-4" />
          <span className="font-medium">{t('cart.complete')}</span>
        </div>
      )}
    </div>
  );
};
