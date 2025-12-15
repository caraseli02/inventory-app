import { useTranslation } from 'react-i18next';
import { Package, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';

interface QuickAddGridProps {
  /** Products to display in the grid */
  products: Product[];
  /** Called when a product is tapped */
  onProductSelect: (product: Product) => void;
  /** Title for the section */
  title?: string;
  /** Maximum number of items to show */
  maxItems?: number;
  /** Whether the grid is loading */
  isLoading?: boolean;
}

/**
 * Quick add grid for one-tap product addition.
 * Shows product image, name, price with large tap targets.
 * Based on POS best practices from Square and Shopify.
 */
export const QuickAddGrid = ({
  products,
  onProductSelect,
  title,
  maxItems = 8,
  isLoading = false,
}: QuickAddGridProps) => {
  const { t } = useTranslation();

  const displayProducts = products.slice(0, maxItems);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {title && (
          <div className="flex items-center gap-2 text-stone-500">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-stone-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (displayProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2 text-stone-500">
          <Clock className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {displayProducts.map((product) => {
          const imageUrl = product.fields.Image?.[0]?.url;
          const price = product.fields.Price;
          const stock = product.fields['Current Stock Level'] ?? 0;
          const isOutOfStock = stock <= 0;

          return (
            <Button
              key={product.id}
              variant="outline"
              className={`relative h-auto flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${
                isOutOfStock
                  ? 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'
                  : 'border-stone-200 hover:border-[var(--color-forest)] hover:bg-stone-50 active:scale-95'
              }`}
              onClick={() => !isOutOfStock && onProductSelect(product)}
              disabled={isOutOfStock}
              title={product.fields.Name}
            >
              {/* Product Image */}
              <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center overflow-hidden mb-1.5 border border-stone-200">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Package className="h-6 w-6 text-stone-400" />
                )}
              </div>

              {/* Product Name */}
              <p className="text-[10px] font-medium text-stone-700 text-center line-clamp-2 leading-tight w-full">
                {product.fields.Name}
              </p>

              {/* Price */}
              {price != null && (
                <p className="text-xs font-bold text-stone-900 mt-0.5">
                  €{price.toFixed(2)}
                </p>
              )}

              {/* Quick Add Icon - subtle overlay */}
              {!isOutOfStock && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--color-forest)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Out of Stock Badge */}
              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <span className="text-[10px] font-medium text-stone-500">
                    {t('search.outOfStock', 'Out')}
                  </span>
                </div>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
