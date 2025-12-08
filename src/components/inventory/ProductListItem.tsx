import { memo } from 'react';
import { Plus, Minus, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
  isLoading?: boolean;
}

const ProductListItemComponent = ({
  product,
  onViewDetails,
  onQuickAdjust,
  isLoading = false,
}: ProductListItemProps) => {
  const currentStock = product.fields['Current Stock Level'] ?? 0;
  const minStock = product.fields['Min Stock Level'] ?? 0;
  const isLowStock = currentStock < minStock && minStock > 0;
  const imageUrl = product.fields.Image?.[0]?.url;

  return (
    <Card
      className="group cursor-pointer border-2 border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-lg"
      onClick={() => onViewDetails(product)}
    >
      <div className="flex gap-3">
        {/* Product Image */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.fields.Name}
            className="h-20 w-20 rounded-lg object-cover border border-stone-200"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
            <span className="text-2xl text-stone-400">📦</span>
          </div>
        )}

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-stone-900 truncate">
              {product.fields.Name}
            </h3>
            {isLowStock && (
              <AlertTriangle className="h-5 w-5 text-[var(--color-terracotta)] flex-shrink-0" />
            )}
          </div>

          {/* Category Badge */}
          {product.fields.Category && (
            <Badge
              variant="secondary"
              className="bg-stone-100 border-stone-200 text-xs mb-2"
            >
              {product.fields.Category}
            </Badge>
          )}

          {/* Stock and Price */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-600">Stock:</span>
              <span
                className={`font-bold ${
                  isLowStock ? 'text-[var(--color-terracotta)]' : 'text-stone-900'
                }`}
              >
                {currentStock}
              </span>
            </div>
            {product.fields.Price != null && (
              <span className="text-lg font-bold text-stone-900">
                €{product.fields.Price.toFixed(2)}
              </span>
            )}
          </div>

          {/* Quick Adjust Buttons */}
          {onQuickAdjust && (
            <div
              className="flex items-center gap-2 mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 border-2 border-stone-300"
                onClick={() => onQuickAdjust(product.id, -1)}
                disabled={isLoading || currentStock === 0}
              >
                {isLoading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                ) : (
                  <>
                    <Minus className="h-4 w-4 mr-1" />
                    Remove
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 border-2 border-stone-300"
                onClick={() => onQuickAdjust(product.id, 1)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const ProductListItem = memo(ProductListItemComponent);
