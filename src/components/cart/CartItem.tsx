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
    <div className="space-y-0">
      {/* Product Card */}
      <div className="group bg-white border-2 border-stone-200 rounded-lg p-4 transition-all duration-200 hover:shadow-lg lg:hover:-translate-y-1">
        <div className="flex gap-4 items-center">
          {/* Product Image */}
          <div className="w-14 h-14 bg-stone-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.product.fields.Name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <BoxIcon className="h-7 w-7 text-stone-400" />
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-stone-900 truncate">
              {item.product.fields.Name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {/* Category Badge */}
              <Badge variant="secondary" className="text-xs bg-stone-100 text-stone-700 hover:bg-stone-100">
                {category}
              </Badge>
              {/* Price */}
              {price != null && (
                <span className="text-sm font-bold" style={{ color: 'var(--color-forest)' }}>
                  €{price.toFixed(2)}/kg
                </span>
              )}
            </div>
          </div>

          {/* Quantity Controls - Desktop only (inline) */}
          <div
            className="hidden lg:flex items-center gap-3 bg-stone-50 border-2 border-stone-200 rounded-lg px-2 py-1 transition-colors"
            style={{
              borderColor: status === 'processing' ? 'var(--color-lavender)' : undefined,
            }}
          >
            <button
              onClick={() => onUpdateQuantity(index, -1)}
              className="w-8 h-8 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span className="font-bold text-lg min-w-[2rem] text-center">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(index, 1)}
              className="w-8 h-8 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Status Messages */}
        {status === 'processing' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
            <Spinner size="sm" />
            <span>Processing...</span>
          </div>
        )}
        {status === 'failed' && statusMessage && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
            {statusMessage}
          </div>
        )}
        {status === 'success' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Complete</span>
          </div>
        )}
      </div>

      {/* Quantity Controls - Mobile only (below card) */}
      <div className="lg:hidden bg-white border-2 border-stone-200 border-t-0 rounded-b-lg px-4 py-3 -mt-2">
        <div
          className="flex items-center justify-center gap-3 bg-stone-50 border-2 border-stone-200 rounded-lg px-2 py-1 transition-colors"
          style={{
            borderColor: status === 'processing' ? 'var(--color-lavender)' : undefined,
          }}
        >
          <button
            onClick={() => onUpdateQuantity(index, -1)}
            className="w-10 h-10 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
          <span className="font-bold text-xl min-w-[3rem] text-center">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(index, 1)}
            className="w-10 h-10 flex items-center justify-center rounded-md bg-white hover:text-white transition-colors font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};
