import { useState } from 'react';
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

interface ProductDetailProps {
  barcode: string;
  onScanNew: () => void;
}

const ProductDetail = ({ barcode, onScanNew }: ProductDetailProps) => {
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

  const displayCategory = product.fields.Category || 'Uncategorized';
  const displayPrice =
    product.fields.Price != null ? `€${product.fields.Price.toFixed(2)}` : 'N/A';
  const expiryDisplay = product.fields['Expiry Date'] || 'No expiry date';

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
    <Card className="w-full max-w-lg mx-auto animate-in fade-in duration-500 shadow-none border-none border-stone-200 relative">
      <CardHeader className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-stone-200 shadow-sm">
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
                  <BoxIcon className="h-8 w-8 text-stone-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-stone-900 leading-tight">{product.fields.Name}</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditDialog(true)}
                    className="border-2 border-stone-300 hover:bg-stone-100 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    ✏️ Edit
                  </Button>
                </div>
                <Badge variant="secondary" className="bg-stone-100 text-stone-700 border-stone-300">
                  {displayCategory}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-light text-stone-900">
              {currentStock}
            </div>
            <div className="text-xs text-stone-500 uppercase tracking-widest font-semibold mt-1">In Stock</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 py-6 pb-24 md:pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
            <CardContent className="p-4">
              <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Price</div>
              <div className="text-stone-900 font-semibold text-lg">{displayPrice}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-stone-50 to-white border-2 border-stone-200">
            <CardContent className="p-4">
              <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Expiry</div>
              <div className="text-stone-900 font-semibold text-sm">{expiryDisplay}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quantity Controls */}
        <div className="mb-4">
          <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Adjust Quantity</div>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => {
                const current = parseInt(stockQuantity);
                if (current > 1) setStockQuantity(String(current - 1));
              }}
              disabled={parseInt(stockQuantity) <= 1}
              variant="outline"
              size="lg"
              className="w-14 h-14 text-2xl font-bold border-2 border-stone-300 hover:border-stone-400"
            >
              −
            </Button>
            <div className="w-28">
              <Input
                type="number"
                min="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="h-14 text-center text-2xl font-bold border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
              />
            </div>
            <Button
              onClick={() => {
                const current = parseInt(stockQuantity);
                setStockQuantity(String(current + 1));
              }}
              variant="outline"
              size="lg"
              className="w-14 h-14 text-2xl font-bold border-2 border-stone-300 hover:border-stone-400"
            >
              +
            </Button>
          </div>
        </div>

        {/* Action Buttons - Both Visible */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            onClick={() => handleStockButton('IN')}
            disabled={loadingAction !== null}
            size="lg"
            className="font-semibold bg-gradient-to-br from-[var(--color-forest)] to-[var(--color-forest-dark)] hover:opacity-90 text-white"
          >
            {loadingAction === 'IN' ? (
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-lg">📥</span>
                Add Stock
              </span>
            )}
          </Button>
          <Button
            onClick={() => handleStockButton('OUT')}
            disabled={loadingAction !== null || currentStock < parseInt(stockQuantity)}
            variant="outline"
            size="lg"
            className="font-semibold border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-[var(--color-terracotta)] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAction === 'OUT' ? (
              <span className="animate-spin h-4 w-4 border-2 border-current/30 border-t-current rounded-full"></span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-lg">📤</span>
                Remove Stock
              </span>
            )}
          </Button>
        </div>

        {/* Validation Warning */}
        {currentStock < parseInt(stockQuantity) && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ Cannot remove {stockQuantity} units. Only {currentStock} in stock.
            </p>
          </div>
        )}

        {/* Recent Activity Section */}
        <div className="border-t-2 border-stone-200 pt-4 mt-4">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recentHistory.map((move) => (
              <div key={move.id} className="flex justify-between items-center text-sm p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-2.5">
                  <Badge
                    variant={move.fields.Type === 'IN' ? 'default' : 'destructive'}
                    className={`w-2 h-2 p-0 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span className="text-stone-600 font-medium text-xs">{move.fields.Date}</span>
                </div>
                <div className={`font-mono font-bold text-sm ${move.fields.Type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                </div>
              </div>
            ))}
            {recentHistory.length === 0 && (
              <div className="text-stone-500 text-sm text-center italic py-3">No recent movements</div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 border-t-2 border-stone-200 sticky bottom-0 w-full z-10">
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="border-2 border-[var(--color-terracotta)] text-[var(--color-terracotta)] hover:bg-red-50 font-semibold flex items-center gap-2"
          >
            🗑️ Delete
          </Button>
          <Button
            onClick={onScanNew}
            className="flex-1 h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
          >
            Scan Another Product
          </Button>
        </div>
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
