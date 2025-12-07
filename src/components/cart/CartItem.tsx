import type { CartItem as CartItemType } from '../../types';
import { Badge } from '../ui/badge';
import { BoxIcon, CheckCircleIcon } from '../ui/Icons';
import { Spinner } from '../ui/spinner';

interface CartItemProps {
  item: CartItemType;
  index: number;
  onUpdateQuantity: (index: number, delta: number) => void;
}

/**
 * Enhanced cart item with category badges, hover effects, and status indicators
 */
export const CartItem = ({ item, index, onUpdateQuantity }: CartItemProps) => {
  const imageUrl = item.product.fields.Image?.[0]?.url;
  const price = item.product.fields.Price;
  const category = item.product.fields.Category || 'General';
  const { status, statusMessage } = item;

  return (
    <div className="bg-white border-2 border-stone-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg lg:hover:-translate-y-1">
      <div className="flex gap-0 h-full">
        {/* Product Image - Full height on left with max 120px */}
        <div className="w-20 lg:w-24 max-h-[120px] bg-stone-100 flex items-center justify-center shrink-0 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.product.fields.Name}
              className="w-full h-full object-contain"
            />
          ) : (
            <BoxIcon className="h-8 w-8 text-stone-400" />
          )}
        </div>

        {/* Product Info & Controls */}
        <div className="flex-1 p-3 lg:p-4 flex flex-col justify-between">
          {/* Top: Name and Category */}
          <div>
            <h3 className="font-semibold text-stone-900 text-sm lg:text-base leading-tight mb-1.5">
              {item.product.fields.Name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Badge */}
              <Badge variant="secondary" className="text-xs bg-stone-100 text-stone-700 hover:bg-stone-100">
                {category}
              </Badge>
              {/* Price */}
              {price != null && (
                <span className="text-xs lg:text-sm font-bold" style={{ color: 'var(--color-forest)' }}>
                  €{price.toFixed(2)}/kg
                </span>
              )}
            </div>
          </div>

          {/* Bottom: Quantity Controls - Compact inline */}
          <div className="mt-2">
            <div
              className="inline-flex items-center gap-2 bg-stone-50 border-2 border-stone-200 rounded-lg px-2 py-1 transition-colors"
              style={{
                borderColor: status === 'processing' ? 'var(--color-lavender)' : undefined,
              }}
            >
              <button
                onClick={() => onUpdateQuantity(index, -1)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  '--hover-bg': 'var(--color-forest)',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-forest)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
                disabled={status === 'processing'}
              >
                −
              </button>
              <span className="font-bold text-base min-w-[1.5rem] text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(index, 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-forest)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
                disabled={status === 'processing'}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {status === 'processing' && (
        <div className="px-3 pb-3 flex items-center gap-2 text-sm text-blue-700">
          <Spinner size="sm" />
          <span>Processing...</span>
        </div>
      )}
      {status === 'failed' && statusMessage && (
        <div className="px-3 pb-3">
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {statusMessage}
          </div>
        </div>
      )}
      {status === 'success' && (
        <div className="px-3 pb-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircleIcon className="h-4 w-4" />
          <span>Complete</span>
        </div>
      )}
    </div>
  );
};
