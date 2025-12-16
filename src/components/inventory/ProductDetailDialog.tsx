import { useTranslation } from 'react-i18next';
import { X, Barcode, Tag, Euro, Calendar, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Package as PackageIcon, Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { ProductImage } from '../ui/product-image';
import { getStockMovements } from '../../lib/api';
import { logger } from '../../lib/logger';
import type { Product } from '../../types';

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (product: Product) => void;
}

export const ProductDetailDialog = ({
  product,
  open,
  onClose,
  onEdit,
}: ProductDetailDialogProps) => {
  const { t } = useTranslation();

  // Use React Query for stock movements - handles loading state automatically
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['stockMovements', product?.id],
    queryFn: async () => {
      if (!product) return [];
      try {
        return await getStockMovements(product.id);
      } catch (error) {
        logger.error('Failed to fetch stock movements', {
          productId: product.id,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        return [];
      }
    },
    enabled: open && !!product,
    staleTime: 1000 * 60, // 1 minute
  });

  if (!product) return null;

  const currentStock = product.fields['Current Stock Level'] ?? 0;
  const minStock = product.fields['Min Stock Level'] ?? 0;
  const isLowStock = currentStock < minStock && minStock > 0;
  const imageUrl = product.fields.Image?.[0]?.url;

  // Calculate lifetime stock totals from movements in a single pass
  const { lifetimeIn, lifetimeOut } = movements.reduce(
    (totals, m) => {
      const qty = Math.abs(m.fields.Quantity);
      if (m.fields.Type === 'IN') {
        totals.lifetimeIn += qty;
      } else {
        totals.lifetimeOut += qty;
      }
      return totals;
    },
    { lifetimeIn: 0, lifetimeOut: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="h-dvh w-full max-w-none sm:h-[95vh] sm:max-w-[95vw] sm:max-h-[95vh] overflow-y-auto p-0 sm:p-6"
        aria-describedby="product-detail-description"
      >
        <DialogHeader className="pt-[max(0.75rem,env(safe-area-inset-top))] px-6 pb-2 sm:p-0 sm:pb-2 flex-row items-center justify-between gap-4">
          <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            {t('dialogs.productDetail.title')}
          </DialogTitle>
          <DialogDescription id="product-detail-description" className="sr-only">
            {t('dialogs.productDetail.title')} - {product.fields.Name}
          </DialogDescription>
        </DialogHeader>

        {/* Mobile/Portrait: Vertical Stack | Landscape/Desktop: Three Column Layout */}
        <div className="px-6 pb-6 lg:px-0 lg:pb-0 lg:flex lg:gap-6">
          {/* Left Column: Image (desktop only, hidden on mobile) */}
          <div className="hidden lg:flex lg:justify-start lg:flex-shrink-0">
            <ProductImage
              src={imageUrl}
              alt={product.fields.Name}
              size="xl"
              showZoom
              className="lg:w-48 xl:w-56"
            />
          </div>

          {/* Middle Column: Product Details */}
          <div className="flex-1 space-y-6 lg:overflow-y-auto lg:max-h-[calc(90vh-120px)]">
            {/* Product Name (shown first on mobile) */}
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-stone-900 mb-2">
                {product.fields.Name}
              </h2>
              {product.fields.Category && (
                <Badge variant="secondary" className="bg-stone-100 border-stone-200">
                  {t(`categories.${product.fields.Category}`)}
                </Badge>
              )}
            </div>

            {/* Product Image (mobile only, shown after name) */}
            <div className="flex justify-center lg:hidden">
              <ProductImage
                src={imageUrl}
                alt={product.fields.Name}
                size="xl"
                showZoom
              />
            </div>

            {/* Product Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Barcode */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <Barcode className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.barcode')}</p>
                <p className="font-mono text-stone-900 font-bold">
                  {product.fields.Barcode}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <Euro className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.price')}</p>
                <p className="text-stone-900 font-bold">
                  {product.fields.Price != null
                    ? `€${product.fields.Price.toFixed(2)}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Current Stock */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <PackageIcon className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.currentStock')}</p>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      isLowStock
                        ? 'text-[var(--color-terracotta)]'
                        : 'text-stone-900'
                    }`}
                  >
                    {currentStock}
                  </p>
                  {isLowStock && (
                    <AlertTriangle className="h-5 w-5 text-[var(--color-terracotta)]" />
                  )}
                </div>
              </div>
            </div>

            {/* Min Stock Level */}
            {minStock > 0 && (
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <Tag className="h-5 w-5 text-stone-600 mt-0.5" />
                <div>
                  <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.minStockLevel')}</p>
                  <p className="text-stone-900 font-bold">{minStock}</p>
                </div>
              </div>
            )}

            {/* Expiry Date */}
            {product.fields['Expiry Date'] && (
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <Calendar className="h-5 w-5 text-stone-600 mt-0.5" />
                <div>
                  <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.expiryDate')}</p>
                  <p className="text-stone-900 font-bold">
                    {new Date(product.fields['Expiry Date']).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Supplier */}
            {product.fields.Supplier && (
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <Tag className="h-5 w-5 text-stone-600 mt-0.5" />
                <div>
                  <p className="text-sm text-stone-600 font-medium">{t('dialogs.productDetail.supplier')}</p>
                  <p className="text-stone-900 font-bold">{product.fields.Supplier}</p>
                </div>
              </div>
            )}
            </div>

            {/* Lifetime Stock Statistics */}
            {movements.length > 0 && (
              <div className="mt-4 p-4 bg-gradient-to-br from-stone-50 to-stone-100/50 rounded-lg border border-stone-200">
                <h4 className="text-sm font-semibold text-stone-700 mb-3">{t('dialogs.productDetail.lifetimeStats', 'Lifetime Statistics')}</h4>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-forest)]/20 text-[var(--color-forest)] text-xs font-bold">+</span>
                    <div>
                      <p className="text-xs text-stone-500">{t('dialogs.productDetail.totalIn', 'Total In')}</p>
                      <p className="font-bold text-stone-900">{lifetimeIn}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-300/50 text-stone-600 text-xs font-bold">−</span>
                    <div>
                      <p className="text-xs text-stone-500">{t('dialogs.productDetail.totalOut', 'Total Out')}</p>
                      <p className="font-bold text-stone-900">{lifetimeOut}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Mobile/Portrait Only */}
            <div className="lg:hidden flex justify-center gap-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-stone-200">
              {onEdit && (
                <Button
                  onClick={() => {
                    onClose();
                    onEdit(product);
                  }}
                  className="flex-1 max-w-[10rem] h-12 font-semibold"
                  style={{
                    background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
                    color: 'white',
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('common.edit', 'Edit')}
                </Button>
              )}
              <Button
                onClick={onClose}
                className="flex-1 max-w-[10rem] h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
              >
                <X className="h-4 w-4 mr-2" />
                {t('dialogs.productDetail.close')}
              </Button>
            </div>
          </div>

          {/* Right Column: Stock Movement History (only on lg+) */}
          <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96">
            <div className="space-y-4 overflow-y-auto lg:max-h-[calc(90vh-120px)]">
              <h3 className="text-lg font-bold text-stone-900 sticky top-0 bg-white py-2">
                {t('dialogs.productDetail.recentMovements')}
              </h3>
              {loadingMovements ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" label={t('dialogs.productDetail.loadingMovements')} />
                </div>
              ) : movements.length > 0 ? (
                <div className="space-y-2">
                  {movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            movement.fields.Type === 'IN' ? 'default' : 'secondary'
                          }
                          className={
                            movement.fields.Type === 'IN'
                              ? 'bg-[var(--color-forest)] text-white'
                              : 'bg-stone-200 text-stone-900'
                          }
                        >
                          {movement.fields.Type === 'IN' ? (
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowUpFromLine className="h-3 w-3 mr-1" />
                          )}
                          {movement.fields.Type}
                        </Badge>
                        <span className="font-bold text-stone-900">
                          {Math.abs(movement.fields.Quantity)} {t('dialogs.productDetail.units')}
                        </span>
                      </div>
                      <span className="text-sm text-stone-600">
                        {movement.fields.Date
                          ? new Date(movement.fields.Date).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-stone-600 text-center py-4">
                  {t('dialogs.productDetail.noMovements')}
                </p>
              )}
            </div>

            {/* Action Buttons - Landscape/Desktop Only */}
            <div className="hidden lg:flex justify-end gap-3 pt-4 mt-4 border-t border-stone-200">
              {onEdit && (
                <Button
                  onClick={() => {
                    onClose();
                    onEdit(product);
                  }}
                  className="font-semibold"
                  style={{
                    background: 'linear-gradient(to bottom right, var(--color-forest), var(--color-forest-dark))',
                    color: 'white',
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {t('common.edit', 'Edit')}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="border-2 border-stone-300"
              >
                <X className="h-4 w-4 mr-2" />
                {t('dialogs.productDetail.close')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
