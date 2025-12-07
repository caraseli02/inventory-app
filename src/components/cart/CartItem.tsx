import type { CartItem as CartItemType } from '../../types';
import { Button } from '../ui/button';
import { BoxIcon, MinusIcon, PlusIcon } from '../ui/Icons';

interface CartItemProps {
  item: CartItemType;
  index: number;
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove?: (index: number) => void;
}

/**
 * Individual cart item with product info, quantity controls, and optional remove button
 */
export const CartItem = ({ item, index, onUpdateQuantity, onRemove }: CartItemProps) => {
  const imageUrl = item.product.fields.Image?.[0]?.url;
  const price = item.product.fields.Price;
  const priceDisplay = price != null ? `€${price.toFixed(2)}/kg` : 'No price';

  return (
    <div className="flex items-start gap-4">
      {/* Product Image */}
      <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.product.fields.Name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BoxIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 text-base mb-1">
          {item.product.fields.Name}
        </h4>
        <p className="text-sm text-gray-500 mb-2">
          {item.product.fields.Category || '1kg'} • {priceDisplay}
        </p>

        {/* Quantity Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateQuantity(index, -1)}
              className="h-8 w-8 p-0 hover:bg-gray-200"
            >
              <MinusIcon className="h-4 w-4 text-stone-900" />
            </Button>
            <span className="w-8 text-center font-semibold text-gray-900">
              {item.quantity}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdateQuantity(index, 1)}
              className="h-8 w-8 p-0 hover:bg-gray-200"
            >
              <PlusIcon className="h-4 w-4 text-stone-900" />
            </Button>
          </div>

          {/* Optional Remove Button */}
          {onRemove && (
            <Button
              size="sm"
              onClick={() => onRemove(index)}
              className="text-xs bg-stone-900 hover:bg-stone-800 text-white"
            >
              Remove
            </Button>
          )}
        </div>

        {/* Item Total */}
        {price != null && (
          <div className="text-sm font-semibold text-stone-900 mt-2">
            Total: €{(price * item.quantity).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
};
