import { useTranslation } from 'react-i18next';
import { Barcode, Tag, Euro, Calendar, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Package as PackageIcon, Pencil, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { ProductImage } from '../ui/product-image';
import { Card, CardContent } from '../ui/card';
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
        className="!fixed !inset-0 w-full !max-w-full !max-h-full p-0 gap-0 !rounded-none !translate-x-0 !translate-y-0 overflow-hidden"
        style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
        aria-describedby="product-detail-description"
      >
        <div className="h-full flex flex-col">
          {/* Header with gradient */}
          <DialogHeader className="pt-[max(0.75rem,env(safe-area-inset-top))] px-6 pb-4 sm:px-8 sm:pt-6 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 border-b border-zinc-200 flex-shrink-0">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-1">
              {product.fields.Name}
            </DialogTitle>
            {product.fields.Category && (
              <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 border-zinc-200 mt-1">
                {t(`categories.${product.fields.Category}`)}
              </Badge>
            )}
            <DialogDescription id="product-detail-description" className="sr-only">
              {t('dialogs.productDetail.title')} - {product.fields.Name}
            </DialogDescription>
          </DialogHeader>

          {/* Main Content Area - Full height with scrolling */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 sm:p-8 space-y-6 pb-24">
            {/* Product Hero Section */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Product Image */}
              <div className="flex-shrink-0 lg:w-64">
                <ProductImage
                  src={imageUrl}
                  alt={product.fields.Name}
                  size="lg"
                  showZoom
                  className="w-full h-48 lg:h-56 object-cover rounded-xl shadow-sm border border-zinc-200"
                />
              </div>

              {/* Key Metrics Cards */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {/* Price Card */}
                <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-emerald-50 rounded-lg">
                        <Euro className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
                          {t('dialogs.productDetail.price')}
                        </p>
                        <p className="text-xl font-bold text-zinc-900">
                          {product.fields.Price != null ? `€${product.fields.Price.toFixed(2)}` : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Stock Card */}
                <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-lg ${isLowStock ? 'bg-red-50' : 'bg-blue-50'}`}>
                        <PackageIcon className={`h-4 w-4 ${isLowStock ? 'text-red-600' : 'text-blue-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
                          {t('dialogs.productDetail.currentStock')}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className={`text-xl font-bold ${isLowStock ? 'text-red-600' : 'text-zinc-900'}`}>
                            {currentStock}
                          </p>
                          {isLowStock && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Barcode Card */}
                <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-violet-50 rounded-lg">
                        <Barcode className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
                          {t('dialogs.productDetail.barcode')}
                        </p>
                        <p className="text-sm font-mono font-semibold text-zinc-900 break-all">
                          {product.fields.Barcode}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Min Stock Card */}
                {minStock > 0 && (
                  <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-amber-50 rounded-lg">
                          <Tag className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
                            {t('dialogs.productDetail.minStockLevel')}
                          </p>
                          <p className="text-xl font-bold text-zinc-900">{minStock}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Additional Details Section */}
            {(product.fields['Expiry Date'] || product.fields.Supplier) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {product.fields['Expiry Date'] && (
                  <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="h-4 w-4 text-zinc-500" />
                        <div>
                          <p className="text-[10px] font-medium text-zinc-500 mb-0.5">
                            {t('dialogs.productDetail.expiryDate')}
                          </p>
                          <p className="text-sm font-semibold text-zinc-900">
                            {new Date(product.fields['Expiry Date']).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {product.fields.Supplier && (
                  <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Tag className="h-4 w-4 text-zinc-500" />
                        <div>
                          <p className="text-[10px] font-medium text-zinc-500 mb-0.5">
                            {t('dialogs.productDetail.supplier')}
                          </p>
                          <p className="text-sm font-semibold text-zinc-900">{product.fields.Supplier}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Lifetime Statistics */}
            {movements.length > 0 && (
              <Card className="border-zinc-200 shadow-sm bg-gradient-to-br from-zinc-50 to-white">
                <CardContent className="p-4">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wide mb-3">
                    {t('dialogs.productDetail.lifetimeStats', 'Lifetime Statistics')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">
                          {t('dialogs.productDetail.totalIn', 'Total In')}
                        </p>
                        <p className="text-xl font-bold text-zinc-900">{lifetimeIn}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-zinc-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">
                          {t('dialogs.productDetail.totalOut', 'Total Out')}
                        </p>
                        <p className="text-xl font-bold text-zinc-900">{lifetimeOut}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stock Movement History */}
            <div>
              <h3 className="text-base font-bold text-zinc-900 mb-3">
                {t('dialogs.productDetail.recentMovements')}
              </h3>
              {loadingMovements ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" label={t('dialogs.productDetail.loadingMovements')} />
                </div>
              ) : movements.length > 0 ? (
                <div className="space-y-2">
                  {movements.slice(0, 10).map((movement) => (
                    <Card
                      key={movement.id}
                      className="border-zinc-200 shadow-sm hover:shadow-md transition-all"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2 rounded-lg ${
                                movement.fields.Type === 'IN' ? 'bg-emerald-50' : 'bg-zinc-100'
                              }`}
                            >
                              {movement.fields.Type === 'IN' ? (
                                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ArrowUpFromLine className="h-4 w-4 text-zinc-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">
                                {movement.fields.Type === 'IN' ? '+' : '−'}
                                {Math.abs(movement.fields.Quantity)} {t('dialogs.productDetail.units')}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {movement.fields.Date
                                  ? new Date(movement.fields.Date).toLocaleDateString()
                                  : '—'}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={movement.fields.Type === 'IN' ? 'default' : 'secondary'}
                            className={
                              movement.fields.Type === 'IN'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-200 text-zinc-900'
                            }
                          >
                            {movement.fields.Type}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-zinc-200">
                  <CardContent className="p-8">
                    <p className="text-center text-zinc-500">
                      {t('dialogs.productDetail.noMovements')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          </div>

          {/* Footer with Actions - Sticky at bottom */}
          <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 px-6 py-4 sm:px-8 flex justify-between items-center gap-4 flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-zinc-300 hover:bg-zinc-100"
            >
              <X className="h-4 w-4 mr-2" />
              {t('dialogs.productDetail.close')}
            </Button>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
