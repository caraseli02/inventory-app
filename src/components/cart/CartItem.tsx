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
 * Enhanced cart item with category badges, hover effects, and status indicators
 * Optimized for touch with 44px minimum touch targets
 */
export const CartItem = ({ item, index, onUpdateQuantity }: CartItemProps) => {
  const { t } = useTranslation();
  const imageUrl = item.product.fields.Image?.[0]?.url;
  const price = item.product.fields.Price;
  const category = item.product.fields.Category ? t(`categories.${item.product.fields.Category}`) : t('categories.General');
  const { status, statusMessage } = item;
  const isProcessing = status === 'processing';

  return (
    <div
      className={`bg-white border-2 rounded-xl overflow-hidden transition-all duration-150 ${
        status === 'failed'
          ? 'border-red-200 bg-red-50/30'
          : status === 'success'
          ? 'border-green-200 bg-green-50/30'
          : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      <div className="flex gap-0 items-stretch">
        {/* Product Image - Fixed width, full height of card */}
        <div className="w-24 min-h-[96px] bg-stone-100 flex items-center justify-center shrink-0 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.product.fields.Name}
              className="w-full h-full object-cover"
            />
          ) : (
            <BoxIcon className="h-10 w-10 text-stone-400" />
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          {/* Top: Name, Category, Price */}
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

          {/* Bottom: Quantity Controls - 44px touch targets */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Decrease Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onUpdateQuantity(index, -1)}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg bg-white border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 transition-colors"
                disabled={isProcessing}
                aria-label={t('cart.decreaseQuantity', 'Decrease quantity')}
              >
                <Minus className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>

              {/* Quantity Display */}
              <span className="font-bold text-lg min-w-[2.5rem] text-center tabular-nums">
                {item.quantity}
              </span>

              {/* Increase Button */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onUpdateQuantity(index, 1)}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg bg-white border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 transition-colors"
                disabled={isProcessing}
                aria-label={t('cart.increaseQuantity', 'Increase quantity')}
              >
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            </div>

            {/* Item Total & Remove */}
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
                onClick={() => onUpdateQuantity(index, -item.quantity)}
                className="h-11 w-11 sm:h-10 sm:w-10 rounded-lg text-stone-400 hover:text-[var(--color-terracotta)] hover:bg-red-50 transition-colors"
                disabled={isProcessing}
                title={t('cart.removeItem')}
                aria-label={t('cart.removeItem')}
              >
                <TrashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
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
