import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Product } from '../../types';

// Module-level constant to avoid creating new Set on every render
const EMPTY_LOADING_SET = new Set<string>();

interface InventoryTableProps {
  products: Product[];
  onViewDetails: (product: Product) => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  loadingProductIds?: Set<string>;
}

const InventoryTableComponent = ({
  products,
  onViewDetails,
  onQuickAdjust,
  onEdit,
  onDelete,
  loadingProductIds = EMPTY_LOADING_SET,
}: InventoryTableProps) => {
  const { t } = useTranslation();

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-bold text-stone-900 mb-2">{t('inventory.noProducts')}</h3>
        <p className="text-stone-600">
          {t('inventory.adjustFilters')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-stone-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200">
            <TableHead className="w-[80px] lg:w-[100px]">{t('inventory.table.image')}</TableHead>
            <TableHead className="font-bold text-stone-900 text-base">{t('inventory.table.name')}</TableHead>
            <TableHead className="font-bold text-stone-900 text-base">{t('inventory.table.barcode')}</TableHead>
            <TableHead className="font-bold text-stone-900 text-base">{t('inventory.table.category')}</TableHead>
            <TableHead className="font-bold text-stone-900 text-base text-right">{t('inventory.table.stock')}</TableHead>
            <TableHead className="font-bold text-stone-900 text-base text-right">{t('inventory.table.price')}</TableHead>
            {(onQuickAdjust || onEdit || onDelete) && (
              <TableHead className="font-bold text-stone-900 text-base text-center w-[220px] lg:w-[280px]">
                {t('inventory.table.actions')}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const currentStock = product.fields['Current Stock Level'] ?? 0;
            const minStock = product.fields['Min Stock Level'] ?? 0;
            const isLowStock = currentStock < minStock && minStock > 0;
            const imageUrl = product.fields.Image?.[0]?.url;
            const isLoading = loadingProductIds.has(product.id);

            return (
              <TableRow
                key={product.id}
                className="cursor-pointer hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-lavender)] focus:ring-inset h-16 lg:h-20"
                onClick={() => onViewDetails(product)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewDetails(product);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${product.fields.Name}`}
              >
                {/* Image */}
                <TableCell>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.fields.Name}
                      className="h-12 w-12 lg:h-16 lg:w-16 rounded-lg object-cover border border-stone-200"
                    />
                  ) : (
                    <div className="h-12 w-12 lg:h-16 lg:w-16 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
                      <span className="text-lg lg:text-2xl">📦</span>
                    </div>
                  )}
                </TableCell>

                {/* Name */}
                <TableCell className="font-semibold text-stone-900 text-base lg:text-lg">
                  <div className="flex items-center gap-2">
                    {product.fields.Name}
                    {isLowStock && (
                      <AlertTriangle className="h-4 w-4 lg:h-5 lg:w-5 text-[var(--color-terracotta)]" />
                    )}
                  </div>
                </TableCell>

                {/* Barcode */}
                <TableCell className="text-stone-600 font-mono text-sm lg:text-base">
                  {product.fields.Barcode}
                </TableCell>

                {/* Category */}
                <TableCell>
                  {product.fields.Category ? (
                    <Badge variant="secondary" className="bg-stone-100 border-stone-200">
                      {t(`categories.${product.fields.Category}`)}
                    </Badge>
                  ) : (
                    <span className="text-stone-400 text-sm">—</span>
                  )}
                </TableCell>

                {/* Stock */}
                <TableCell className="text-right">
                  <span
                    className={`font-bold text-lg lg:text-xl ${
                      isLowStock
                        ? 'text-[var(--color-terracotta)]'
                        : 'text-stone-900'
                    }`}
                  >
                    {currentStock}
                  </span>
                </TableCell>

                {/* Price */}
                <TableCell className="text-right">
                  {product.fields.Price != null ? (
                    <span className="font-bold text-stone-900 text-base lg:text-lg">
                      €{product.fields.Price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </TableCell>

                {/* Actions */}
                {(onQuickAdjust || onEdit || onDelete) && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-2 justify-center">
                      {/* Quick Adjust */}
                      {onQuickAdjust && (
                        <div className="flex items-center gap-1.5 lg:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 lg:h-9 px-2 lg:px-3 border-2 border-stone-300"
                            onClick={() => onQuickAdjust(product.id, -1)}
                            disabled={isLoading || currentStock === 0}
                            title={t('inventory.table.removeUnit')}
                          >
                            {isLoading ? (
                              <span className="animate-spin h-3 w-3 lg:h-4 lg:w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                            ) : (
                              <Minus className="h-3 w-3 lg:h-4 lg:w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 lg:h-9 px-2 lg:px-3 border-2 border-stone-300"
                            onClick={() => onQuickAdjust(product.id, 1)}
                            disabled={isLoading}
                            title={t('inventory.table.addUnit')}
                          >
                            {isLoading ? (
                              <span className="animate-spin h-3 w-3 lg:h-4 lg:w-4 border-2 border-stone-400 border-t-stone-600 rounded-full"></span>
                            ) : (
                              <Plus className="h-3 w-3 lg:h-4 lg:w-4" />
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Edit and Delete */}
                      {(onEdit || onDelete) && (
                        <div className="flex items-center gap-1.5 lg:gap-2">
                          {onEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 lg:h-9 px-2 lg:px-3 border-2 border-stone-300 hover:bg-stone-100"
                              onClick={() => onEdit(product)}
                              title={t('inventory.table.editProduct')}
                            >
                              <Edit2 className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 lg:h-9 px-2 lg:px-3 border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-red-50"
                              onClick={() => onDelete(product)}
                              title={t('inventory.table.deleteProduct')}
                            >
                              <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const InventoryTable = memo(InventoryTableComponent);
