import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ProductImage } from '../ui/product-image';
import { getProductDisplayPrice } from '@/hooks/useMarkupSetting';
import type { Product } from '../../types';

interface ProductListItemProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  isLoading?: boolean;
}

const ProductListItemComponent = ({
  product,
  onViewDetails,
  onQuickAdjust,
  onEdit,
  onDelete,
  isLoading = false,
}: ProductListItemProps) => {
  const { t } = useTranslation();
  const currentStock = product.fields['Current Stock Level'] ?? 0;
  const minStock = product.fields['Min Stock Level'] ?? 0;
  const isLowStock = currentStock < minStock && minStock > 0;
  const imageUrl = product.fields.Image?.[0]?.url;
  const displayPrice = getProductDisplayPrice(product.fields);

  return (
    <Card
      className={`group cursor-pointer border-2 bg-white p-4 transition-all duration-150 rounded-xl ${
        isLowStock
          ? 'border-orange-200 bg-orange-50/30 hover:border-orange-300'
          : 'border-stone-200 hover:border-stone-300'
      } hover:shadow-md active:scale-[0.99]`}
      onClick={() => onViewDetails(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails(product);
        }
      }}
      aria-label={t('inventory.table.viewDetails', { name: product.fields.Name })}
    >
      <div className="flex gap-3">
        {/* Product Image - Fixed 56px square with standardized styling */}
        <ProductImage
          src={imageUrl}
          alt={product.fields.Name}
          size="sm"
          className="rounded-lg border-stone-200"
        />

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {/* Header: Name and Low Stock Badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-stone-900 text-sm leading-tight line-clamp-2">
              {product.fields.Name}
            </h3>
            {isLowStock && (
              <Badge
                variant="outline"
                className="bg-orange-100 border-orange-300 text-orange-700 text-xs px-1.5 py-0 h-5 flex-shrink-0"
              >
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                {t('inventory.lowStock', 'Low')}
              </Badge>
            )}
          </div>

          {/* Category Badge */}
          {product.fields.Category && (
            <Badge
              variant="secondary"
              className="bg-stone-100 border-stone-200 text-xs mb-2"
            >
              {t(`categories.${product.fields.Category}`, product.fields.Category)}
            </Badge>
          )}

          {/* Stock and Price Row */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-500">{t('product.stock')}:</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  isLowStock ? 'text-[var(--color-terracotta)]' : 'text-stone-900'
                }`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={t('product.stockLevel', { stock: currentStock })}
              >
                {currentStock}
              </span>
            </div>
            {displayPrice != null && (
              <span className="text-base font-bold text-stone-900 tabular-nums">
                €{displayPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Adjust Buttons - 44px touch targets */}
      {onQuickAdjust && (
        <div
          className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            className="h-11 flex-1 border-2 border-stone-300 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
            onClick={() => onQuickAdjust(product.id, -1)}
            disabled={isLoading || currentStock === 0}
            aria-label={t('inventory.table.removeUnit')}
          >
            {isLoading ? (
              <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full" />
            ) : (
              <>
                <Minus className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">{t('product.remove')}</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 border-2 border-stone-300 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
            onClick={() => onQuickAdjust(product.id, 1)}
            disabled={isLoading}
            aria-label={t('inventory.table.addUnit')}
          >
            {isLoading ? (
              <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">{t('product.add')}</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Edit and Delete Buttons */}
      {(onEdit || onDelete) && (
        <div
          className="flex items-center gap-2 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <Button
              variant="outline"
              className="h-11 flex-1 border-2 border-stone-300 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
              onClick={() => onEdit(product)}
              aria-label={t('inventory.table.editProduct')}
            >
              <Edit2 className="h-4 w-4 mr-1.5" />
              <span className="text-sm font-medium">{t('product.edit')}</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              className="h-11 flex-1 border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[var(--color-terracotta)]"
              onClick={() => onDelete(product)}
              aria-label={t('inventory.table.deleteProduct')}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              <span className="text-sm font-medium">{t('product.delete')}</span>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const ProductListItem = memo(ProductListItemComponent);
