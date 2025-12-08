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

interface ProductDetailProps {
  barcode: string;
  onScanNew: () => void;
  mode: 'add' | 'remove';
}

const ProductDetail = ({ barcode, onScanNew, mode }: ProductDetailProps) => {
  // Fetch product reactively - this ensures we always show fresh data from cache
  const { data: product, isLoading } = useProductLookup(barcode);

  // Initialize hooks unconditionally (Rules of Hooks)
  const [stockQuantity, setStockQuantity] = useState<string>('1');

  // Fetch History - needs product ID
  const { data: history } = useQuery({
    queryKey: ['history', product?.id],
    queryFn: () => getStockMovements(product!.id),
    enabled: !!product?.id,
  });

  // Only initialize mutation hook when product exists
  // Pass a dummy product during loading to satisfy hooks rule
  const dummyProduct = { id: '', fields: { Name: '', Barcode: barcode, 'Current Stock Level': 0 } } as any;
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
              <div>
                <h2 className="text-2xl font-bold text-stone-900 leading-tight mb-1">{product.fields.Name}</h2>
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

      <CardContent className="px-6 py-6 max-h-[calc(100dvh-240px)] md:max-h-none overflow-y-auto">
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

        <div className="flex gap-3 mb-6">
          {mode === 'remove' && (
            <Button
              onClick={() => handleStockButton('OUT')}
              disabled={loadingAction !== null}
              variant="destructive"
              size="lg"
              className="flex-1 font-semibold"
            >
              {loadingAction === 'OUT' ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
              ) : (
                'Remove'
              )}
            </Button>
          )}

          <div className="w-24">
            <Input
              type="number"
              min="1"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="h-10 text-center text-lg font-bold border-2 border-stone-300 focus-visible:ring-[var(--color-lavender)]"
            />
          </div>

          {mode === 'add' && (
            <Button
              variant='outline'
              onClick={() => handleStockButton('IN')}
              disabled={loadingAction !== null}
              size="lg"
              className="flex-1"
            >
              {loadingAction === 'IN' ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
              ) : (
                'Add'
              )}
            </Button>
          )}
        </div>

        {/* Recent Activity Section */}
        <div className="border-t-2 border-stone-200 pt-6">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {recentHistory.map((move) => (
              <div key={move.id} className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={move.fields.Type === 'IN' ? 'default' : 'destructive'}
                    className={`w-2 h-2 p-0 rounded-full ${move.fields.Type === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span className="text-stone-600 font-medium">{move.fields.Date}</span>
                </div>
                <div className={`font-mono font-bold ${move.fields.Type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {move.fields.Type === 'IN' ? '+' : '-'}{Math.abs(move.fields.Quantity)}
                </div>
              </div>
            ))}
            {recentHistory.length === 0 && (
              <div className="text-stone-500 text-sm text-center italic py-4">No recent movements</div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 border-t-2 border-stone-200 fixed md:static bottom-0 w-full">
        <Button
          onClick={onScanNew}
          className="w-full h-12 bg-stone-900 hover:bg-stone-800 text-white font-semibold"
        >
          Scan Another Product
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductDetail;
