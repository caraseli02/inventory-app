import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStockMovements } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';
import { useStockMutation } from '../../hooks/useStockMutation';
import { useProductLookup } from '../../hooks/useProductLookup';
import { BoxIcon } from '../ui/Icons';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ProductSkeleton } from './ProductSkeleton';
import EditProductDialog from './EditProductDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import type { Product } from '../../types';
import { Separator } from '@radix-ui/react-select';

interface ProductDetailProps {
  barcode: string;
  onScanNew: () => void;
}

const ProductDetail = ({ barcode, onScanNew }: ProductDetailProps) => {
  const { t } = useTranslation();
  // Fetch product reactively - this ensures we always show fresh data from cache
  const { data: product, isLoading } = useProductLookup(barcode);

  // Initialize hooks unconditionally (Rules of Hooks)
  const [stockQuantity, setStockQuantity] = useState<string>('1');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch History - needs product ID
  const { data: history } = useQuery({
    queryKey: ['history', product?.id],
    queryFn: () => getStockMovements(product!.id),
    enabled: !!product?.id,
  });

  // Only initialize mutation hook when product exists
  // Pass a dummy product during loading to satisfy hooks rule
  const dummyProduct: Product = {
    id: '',
    createdTime: '',
    fields: { Name: '', Barcode: barcode, 'Current Stock Level': 0 }
  };
  const { handleStockChange, loadingAction } = useStockMutation(product || dummyProduct);

  // Show loading state with skeleton
  if (isLoading || !product) {
    return <ProductSkeleton />;
  }

  const displayCategory = product.fields.Category ? t(`categories.${product.fields.Category}`) : t('categories.Uncategorized');
  const displayPrice =
    product.fields.Price != null ? `€${product.fields.Price.toFixed(2)}` : 'N/A';
  const expiryDisplay = product.fields['Expiry Date'] || t('product.noExpiry');

  // Calculate current stock from ALL movements (since Airtable rollup isn't being returned)
  // Sum all quantities (which are already signed: positive for IN, negative for OUT)
  const calculatedStock = history?.reduce((total, movement) => {
    return total + (movement.fields.Quantity || 0);
  }, 0) ?? 0;

  // Use calculated stock if Airtable rollup is undefined
  const currentStock = product.fields['Current Stock Level'] ?? calculatedStock;

  // Only show the 10 most recent movements in the UI
  const recentHistory = history?.slice(0, 10) ?? [];

  const handleStockButton = (type: 'IN' | 'OUT') => {
    const qty = parseInt(stockQuantity);
    console.log('[ProductDetail] Initiating stock change:', { qty, type, currentStock, calculatedStock });
    handleStockChange(qty, type);
  };

  // Debug: Log current stock value
  console.log('[ProductDetail] Rendering with stock:', {
    airtableStock: product.fields['Current Stock Level'],
    calculatedStock,
    currentStock,
    movementCount: history?.length
  });

  return (
    <Card className="w-full animate-in fade-in duration-500 shadow-none border-none border-stone-200 relative">
      {/* Loading Overlay for Stock Operations */}
      {loadingAction !== null && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-stone-200 border-t-[var(--color-forest)] rounded-full animate-spin"></div>
            <p className="text-stone-900 font-semibold text-lg">
              {loadingAction === 'IN' ? t('product.addStock') : t('product.removeStock')}...
            </p>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-stone-200 shadow-sm">
              {product.fields.Image && product.fields.Image.length > 0 ? (
                <img
                  src={product.fields.Image[0].url}
                  alt={product.fields.Name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target;
                    if (img instanceof HTMLImageElement) {
                      img.style.display = 'none';
                      img.nextElementSibling?.classList.remove('hidden');
                    }
                  }}
                />
              ) : (
                <BoxIcon className="h-6 w-6 text-stone-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg lg:text-xl font-bold text-stone-900 leading-tight mb-0.5 truncate">{product.fields.Name}</h2>
              <Badge variant="secondary" className="bg-stone-100 text-stone-700 border-stone-300 text-xs">
                {displayCategory}
              </Badge>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl lg:text-3xl font-light text-stone-900">
              {currentStock}
            </div>
            <div className="text-[10px] lg:text-xs text-stone-500 uppercase tracking-widest font-semibold">{t('product.inStock')}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 py-4 lg:px-8 lg:py-6 pb-24 md:pb-6 overflow-y-auto">
        {/* Responsive Two-Column Layout: Left = Product Info/Controls, Right = Activity */}
        <div className="lg:flex lg:gap-8 lg:items-start">
          {/* Left Column: Product Info & Controls - takes more space on desktop */}
          <div className="flex-1 lg:max-w-2xl w-full">
            {/* Price & Expiry Cards - larger on desktop */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-6">
              <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
                <CardContent className="p-3 lg:p-4">
                  <div className="text-[10px] lg:text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">{t('product.price')}</div>
                  <div className="text-stone-900 font-semibold text-base lg:text-xl">{displayPrice}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
                <CardContent className="p-3 lg:p-4">
                  <div className="text-[10px] lg:text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">{t('product.expiry')}</div>
                  <div className="text-stone-900 font-semibold text-xs lg:text-sm">{expiryDisplay}</div>
                </CardContent>
              </Card>
            </div>

            {/* Quantity Controls - larger on desktop */}
            <div className="lg:mb-6 border-b border-stone-400 pb-4">
              <div className="text-[10px] lg:text-xs text-stone-500 uppercase tracking-widest font-bold mb-2 lg:mb-3">{t('product.adjustQuantity')}</div>
              <div className="flex items-center gap-2 lg:gap-3">
                <Button
                  onClick={() => {
                    const current = parseInt(stockQuantity);
                    if (current > 1) setStockQuantity(String(current - 1));
                  }}
                  disabled={parseInt(stockQuantity) <= 1}
                  variant="outline"
                  size="lg"
                  className="w-12 h-12 lg:w-14 lg:h-14 text-xl lg:text-2xl font-bold border-2 border-stone-300 hover:border-stone-400"
                >
                  −
                </Button>
                <div className="w-20 lg:w-24">
                  <Input
                    type="number"
                    min="1"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="h-12 lg:h-14 text-center text-xl lg:text-2xl font-bold border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
                  />
                </div>
                <Button
                  onClick={() => {
                    const current = parseInt(stockQuantity);
                    setStockQuantity(String(current + 1));
                  }}
                  variant="outline"
                  size="lg"
                  className="w-12 h-12 lg:w-14 lg:h-14 text-xl lg:text-2xl font-bold border-2 border-stone-300 hover:border-stone-400"
                >
                  +
                </Button>
              </div>
            </div>
            
            <Separator className="my-4 lg:my-6" />

            {/* Action Buttons - larger on desktop */}
            <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-3 lg:mb-4">
              <Button
                onClick={() => handleStockButton('IN')}
                disabled={loadingAction !== null}
                size="lg"
                className="h-11 lg:h-12 font-semibold bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white text-sm lg:text-base"
              >
                {loadingAction === 'IN' ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                ) : (
                  <span className="flex items-center gap-1.5 lg:gap-2">
                    <span className="text-base lg:text-lg">📥</span>
                    {t('product.addStock')}
                  </span>
                )}
              </Button>
              <Button
                onClick={() => handleStockButton('OUT')}
                disabled={loadingAction !== null || currentStock < parseInt(stockQuantity)}
                variant="outline"
                size="lg"
                className="h-11 lg:h-12 font-semibold border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
              >
                {loadingAction === 'OUT' ? (
                  <span className="animate-spin h-4 w-4 border-2 border-current/30 border-t-current rounded-full"></span>
                ) : (
                  <span className="flex items-center gap-1.5 lg:gap-2">
                    <span className="text-base lg:text-lg">📤</span>
                    {t('product.removeStock')}
                  </span>
                )}
              </Button>
            </div>

            {/* Edit and Delete Buttons */}
            <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(true)}
                size="lg"
                className="h-11 lg:h-12 font-semibold border-2 border-stone-300 hover:bg-stone-100 flex items-center justify-center gap-1.5 lg:gap-2 text-sm lg:text-base"
              >
                ✏️ {t('product.editProduct')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                size="lg"
                className="h-11 lg:h-12 font-semibold border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-red-50 flex items-center justify-center gap-1.5 lg:gap-2 text-sm lg:text-base"
              >
                🗑️ {t('product.delete')}
              </Button>
            </div>

            {/* Validation Warning */}
            {currentStock < parseInt(stockQuantity) && (
              <div className="mb-3 p-2 lg:p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-xs lg:text-sm text-red-700 font-medium">
                  ⚠️ {t('product.cannotRemove', { quantity: stockQuantity, available: currentStock })}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Recent Activity - fixed width sidebar on desktop */}
          <div className="lg:w-80 xl:w-96 ml-auto lg:flex-shrink-0 lg:border-l-2 lg:border-stone-200 lg:pl-8 border-t-2 lg:border-t-0 border-stone-200 pt-4 lg:pt-0 mt-4 lg:mt-0">
            <h3 className="text-xs lg:text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">{t('product.recentActivity')}</h3>
            <div className="space-y-2 overflow-y-auto">
              {recentHistory.map((move) => (
                <div key={move.id} className="flex justify-between items-center text-sm p-2.5 lg:p-3 bg-stone-50 rounded-lg border border-stone-200">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={move.fields.Type === 'IN' ? 'default' : 'destructive'}
                      className={`w-2 h-2 p-0 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                    <span className="text-stone-600 font-medium text-xs lg:text-sm">{move.fields.Date}</span>
                  </div>
                  <div className={`font-mono font-bold text-sm lg:text-base ${move.fields.Type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                  </div>
                </div>
              ))}
              {recentHistory.length === 0 && (
                <div className="text-stone-500 text-sm text-center italic py-3">{t('product.noRecentMovements')}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 border-t-2 border-stone-200 sticky bottom-0 w-full z-10">
        <Button
          onClick={onScanNew}
          className="w-full lg:w-fit h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
        >
          {t('product.scanAnother')}
        </Button>
      </CardFooter>

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={product}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        product={product}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onDeleteSuccess={onScanNew}
      />
    </Card>
  );
};

export default ProductDetail;
