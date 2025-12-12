import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, AlertTriangle, Edit2, Trash2, Package } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
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
            <Package className="h-10 w-10 text-stone-400" />
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
              {t(`categories.${product.fields.Category}`, product.fields.Category)}
            </Badge>
          )}

          {/* Stock and Price */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-600">{t('product.stock')}:</span>
              <span
                className={`text-2xl font-bold ${
                  isLowStock ? 'text-[var(--color-terracotta)]' : 'text-stone-900'
                }`}
              >
                {currentStock}
              </span>
            </div>
            {displayPrice != null && (
              <span className="text-lg font-bold text-stone-900">
                €{displayPrice.toFixed(2)}
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
                className="min-h-11 flex-1 border-2 border-stone-300"
                onClick={() => onQuickAdjust(product.id, -1)}
                disabled={isLoading || currentStock === 0}
              >
                {isLoading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                ) : (
                  <>
                    <Minus className="h-4 w-4 mr-1" />
                    {t('product.remove')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 flex-1 border-2 border-stone-300"
                onClick={() => onQuickAdjust(product.id, 1)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('product.add')}
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
                  size="sm"
                  className="min-h-11 flex-1 border-2 border-stone-300 hover:bg-stone-100"
                  onClick={() => onEdit(product)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('product.edit')}
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11 flex-1 border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-red-50"
                  onClick={() => onDelete(product)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {t('product.delete')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const ProductListItem = memo(ProductListItemComponent);
