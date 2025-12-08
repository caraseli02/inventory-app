import { useEffect, useState } from 'react';
import { X, Package, Barcode, Tag, Euro, Calendar, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { getStockMovements } from '../../lib/api';
import { logger } from '../../lib/logger';
import type { Product, StockMovement } from '../../types';

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export const ProductDetailDialog = ({
  product,
  open,
  onClose,
}: ProductDetailDialogProps) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    if (open && product) {
      setLoadingMovements(true);
      getStockMovements(product.id)
        .then(setMovements)
        .catch((error) => {
          logger.error('Failed to fetch stock movements', {
            productId: product.id,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
          setMovements([]);
        })
        .finally(() => setLoadingMovements(false));
    } else {
      setMovements([]);
    }
  }, [open, product]);

  if (!product) return null;

  const currentStock = product.fields['Current Stock Level'] ?? 0;
  const minStock = product.fields['Min Stock Level'] ?? 0;
  const isLowStock = currentStock < minStock && minStock > 0;
  const imageUrl = product.fields.Image?.[0]?.url;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-dvh w-full sm:h-auto sm:max-w-[600px] sm:max-h-[90vh] overflow-y-auto p-0 sm:p-6">
        <DialogHeader className="pt-[max(1.5rem,env(safe-area-inset-top))] px-6 pb-4 sm:p-0 sm:pb-0">
          <DialogTitle className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Package className="h-6 w-6" />
            Product Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6 sm:px-0 sm:pb-0">
          {/* Product Image */}
          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={imageUrl}
                alt={product.fields.Name}
                className="max-h-48 rounded-lg border-2 border-stone-200 object-contain"
              />
            </div>
          )}

          {/* Product Name */}
          <div>
            <h2 className="text-3xl font-bold text-stone-900 mb-2">
              {product.fields.Name}
            </h2>
            {product.fields.Category && (
              <Badge variant="secondary" className="bg-stone-100 border-stone-200">
                {product.fields.Category}
              </Badge>
            )}
          </div>

          {/* Product Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Barcode */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <Barcode className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">Barcode</p>
                <p className="font-mono text-stone-900 font-bold">
                  {product.fields.Barcode}
                </p>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <Euro className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">Price</p>
                <p className="text-stone-900 font-bold">
                  {product.fields.Price != null
                    ? `€${product.fields.Price.toFixed(2)}`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Current Stock */}
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <Package className="h-5 w-5 text-stone-600 mt-0.5" />
              <div>
                <p className="text-sm text-stone-600 font-medium">Current Stock</p>
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
                  <p className="text-sm text-stone-600 font-medium">Min Stock Level</p>
                  <p className="text-stone-900 font-bold">{minStock}</p>
                </div>
              </div>
            )}

            {/* Expiry Date */}
            {product.fields['Expiry Date'] && (
              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                <Calendar className="h-5 w-5 text-stone-600 mt-0.5" />
                <div>
                  <p className="text-sm text-stone-600 font-medium">Expiry Date</p>
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
                  <p className="text-sm text-stone-600 font-medium">Supplier</p>
                  <p className="text-stone-900 font-bold">{product.fields.Supplier}</p>
                </div>
              </div>
            )}
          </div>

          {/* Stock Movement History */}
          <div>
            <h3 className="text-lg font-bold text-stone-900 mb-3">
              Recent Stock Movements
            </h3>
            {loadingMovements ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" label="Loading movements..." />
              </div>
            ) : movements.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
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
                        {movement.fields.Type}
                      </Badge>
                      <span className="font-bold text-stone-900">
                        {Math.abs(movement.fields.Quantity)} units
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
                No stock movements recorded
              </p>
            )}
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 border-t border-stone-200">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-2 border-stone-300"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
