import { Plus, Minus, AlertTriangle } from 'lucide-react';
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

interface InventoryTableProps {
  products: Product[];
  onViewDetails: (product: Product) => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
}

export const InventoryTable = ({
  products,
  onViewDetails,
  onQuickAdjust,
}: InventoryTableProps) => {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-bold text-stone-900 mb-2">No products found</h3>
        <p className="text-stone-600">
          Try adjusting your filters or search query
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-stone-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-br from-stone-50 to-stone-100/50 border-b-2 border-stone-200">
            <TableHead className="w-[80px]">Image</TableHead>
            <TableHead className="font-bold text-stone-900">Name</TableHead>
            <TableHead className="font-bold text-stone-900">Barcode</TableHead>
            <TableHead className="font-bold text-stone-900">Category</TableHead>
            <TableHead className="font-bold text-stone-900 text-right">Stock</TableHead>
            <TableHead className="font-bold text-stone-900 text-right">Price</TableHead>
            {onQuickAdjust && (
              <TableHead className="font-bold text-stone-900 text-center w-[180px]">
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const currentStock = product.fields['Current Stock'] ?? 0;
            const minStock = product.fields['Min Stock Level'] ?? 0;
            const isLowStock = currentStock < minStock && minStock > 0;
            const imageUrl = product.fields.Image?.[0]?.url;

            return (
              <TableRow
                key={product.id}
                className="cursor-pointer hover:bg-stone-50"
                onClick={() => onViewDetails(product)}
              >
                {/* Image */}
                <TableCell>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.fields.Name}
                      className="h-12 w-12 rounded-lg object-cover border border-stone-200"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
                      <span className="text-lg">📦</span>
                    </div>
                  )}
                </TableCell>

                {/* Name */}
                <TableCell className="font-semibold text-stone-900">
                  <div className="flex items-center gap-2">
                    {product.fields.Name}
                    {isLowStock && (
                      <AlertTriangle className="h-4 w-4 text-[var(--color-terracotta)]" />
                    )}
                  </div>
                </TableCell>

                {/* Barcode */}
                <TableCell className="text-stone-600 font-mono text-sm">
                  {product.fields.Barcode}
                </TableCell>

                {/* Category */}
                <TableCell>
                  {product.fields.Category ? (
                    <Badge variant="secondary" className="bg-stone-100 border-stone-200">
                      {product.fields.Category}
                    </Badge>
                  ) : (
                    <span className="text-stone-400 text-sm">—</span>
                  )}
                </TableCell>

                {/* Stock */}
                <TableCell className="text-right">
                  <span
                    className={`font-bold text-lg ${
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
                    <span className="font-bold text-stone-900">
                      €{product.fields.Price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </TableCell>

                {/* Quick Adjust Actions */}
                {onQuickAdjust && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 border-2 border-stone-300"
                        onClick={() => onQuickAdjust(product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 border-2 border-stone-300"
                        onClick={() => onQuickAdjust(product.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
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
