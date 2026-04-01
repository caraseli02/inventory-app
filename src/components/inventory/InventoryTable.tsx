import { memo, useCallback, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, AlertTriangle, Edit2, Trash2, Package, Check } from 'lucide-react';
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
import { Checkbox } from '../ui/checkbox';
import { getProductDisplayPrice } from '@/hooks/useMarkupSetting';
import type { Product } from '../../types';

// Module-level constant to avoid creating new Set on every render
const EMPTY_LOADING_SET = new Set<string>();

// Stock status types for consistent styling
type StockStatus = 'low' | 'medium' | 'good';

function getStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock < minStock && minStock > 0) {
    return 'low';
  }
  if (currentStock <= minStock * 1.5 && minStock > 0) {
    return 'medium';
  }
  return 'good';
}

const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  low: 'text-[var(--color-terracotta)]',
  medium: 'text-amber-600',
  good: 'text-[var(--color-forest)]',
};

const STOCK_BAR_COLORS: Record<StockStatus, string> = {
  low: 'bg-[var(--color-terracotta)]',
  medium: 'bg-amber-500',
  good: 'bg-[var(--color-forest)]',
};

// Common header cell class
const HEADER_CELL_CLASS = 'font-semibold text-stone-700 text-sm bg-gradient-to-br from-stone-50 to-stone-100';

// Reusable loading spinner component
function LoadingSpinner(): ReactElement {
  return (
    <span className="animate-spin h-4 w-4 border-2 border-stone-400 border-t-stone-600 rounded-full" />
  );
}

// Stock status label component to avoid nested ternaries
interface StockStatusLabelProps {
  status: StockStatus;
  t: ReturnType<typeof useTranslation>['t'];
}

function StockStatusLabel({ status, t }: StockStatusLabelProps): ReactElement {
  const labels: Record<StockStatus, { icon: ReactElement | null; key: string; fallback: string }> = {
    low: {
      icon: <AlertTriangle className="h-3 w-3 inline mr-0.5" />,
      key: 'inventory.lowStock',
      fallback: 'Low'
    },
    medium: {
      icon: null,
      key: 'inventory.mediumStock',
      fallback: 'Medium'
    },
    good: {
      icon: <Check className="h-3 w-3 inline mr-0.5" />,
      key: 'inventory.goodStock',
      fallback: 'Good'
    },
  };

  const { icon, key, fallback } = labels[status];

  return (
    <span className={`text-xs font-semibold ${STOCK_STATUS_COLORS[status]}`}>
      {icon}{t(key, fallback)}
    </span>
  );
}

/**
 * Props for the InventoryTable component
 *
 * @property {Product[]} products - Array of products to display in the table
 * @property {(product: Product) => void} onViewDetails - Callback fired when user clicks on a product row to view details
 * @property {(productId: string, delta: number) => void} [onQuickAdjust] - Optional callback for quick stock adjustments (+1/-1). Delta is signed: positive for add, negative for remove
 * @property {(product: Product) => void} [onEdit] - Optional callback fired when user clicks the edit button for a product
 * @property {(product: Product) => void} [onDelete] - Optional callback fired when user clicks the delete button for a product
 * @property {Set<string>} [loadingProductIds] - Optional set of product IDs currently being updated. Used to show loading spinners on quick adjust buttons. Defaults to empty set for stable reference equality
 */
interface InventoryTableProps {
  products: Product[];
  onViewDetails: (product: Product) => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  selectedProductIds?: Set<string>;
  onToggleSelect?: (productId: string, selected: boolean) => void;
  onToggleSelectAll?: (selected: boolean) => void;
  onDeleteSelected?: () => void;
  loadingProductIds?: Set<string>;
}

// Memoized row component to prevent unnecessary re-renders
// Only re-renders when the product data or its loading state changes
interface ProductRowProps {
  product: Product;
  index: number;
  stockStatus: StockStatus;
  isLowStock: boolean;
  imageUrl: string | undefined;
  isLoading: boolean;
  displayPrice: number | null;
  hasBarcode: boolean;
  onViewDetails: () => void;
  onQuickAdjust?: (productId: string, delta: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  selectedProductIds?: Set<string>;
  onToggleSelect?: (productId: string, selected: boolean) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const ProductRow = memo(({
  product,
  index,
  stockStatus,
  isLowStock,
  imageUrl,
  isLoading,
  displayPrice,
  hasBarcode,
  onViewDetails,
  onQuickAdjust,
  onEdit,
  onDelete,
  selectedProductIds,
  onToggleSelect,
  t,
}: ProductRowProps) => {
  const currentStock = product.fields['Current Stock Level'] ?? 0;
  const minStock = product.fields['Min Stock Level'] ?? 0;

  // Memoize stop propagation handler
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <TableRow
      key={product.id}
      className={`
        group cursor-pointer transition-colors duration-100
        ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}
        ${isLowStock ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'hover:bg-stone-100/80'}
        ${selectedProductIds?.has(product.id) ? 'ring-1 ring-[var(--color-forest)]/20' : ''}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-lavender)]
      `}
      onClick={onViewDetails}
      tabIndex={0}
      role="button"
      aria-label={t('inventory.table.viewDetails', { name: product.fields.Name })}
    >
      {/* Selection */}
      <TableCell className="py-2">
        {onToggleSelect && selectedProductIds && (
          <div
            className="flex items-center justify-center"
            onClick={stopPropagation}
          >
            <Checkbox
              checked={selectedProductIds.has(product.id)}
              onCheckedChange={(checked) => onToggleSelect(product.id, checked === true)}
              aria-label={t('inventory.table.selectProduct', { name: product.fields.Name })}
            />
          </div>
        )}
      </TableCell>
      {/* Image - Fixed 48px square */}
      <TableCell className="py-2">
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.fields.Name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-5 w-5 text-stone-400" />
            </div>
          )}
        </div>
      </TableCell>

      {/* Name with barcode subtitle */}
      <TableCell className="py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-900 text-sm">
              {product.fields.Name}
            </span>
            {isLowStock && (
              <Badge
                variant="outline"
                className="bg-orange-100 border-orange-300 text-orange-700 text-xs px-1.5 py-0 h-5"
              >
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                {t('inventory.lowStock', 'Low')}
              </Badge>
            )}
          </div>
          {/* Barcode as subtitle */}
          <span className="text-xs text-stone-500">
            {hasBarcode ? (
              <>
                {t('inventory.barcode', 'Barcode')}: <span className="font-mono">{product.fields.Barcode}</span>
              </>
            ) : (
              <span className="text-stone-400">—</span>
            )}
          </span>
        </div>
      </TableCell>

      {/* Category */}
      <TableCell className="py-2">
        {product.fields.Category ? (
          <Badge variant="secondary" className="bg-stone-100 border-stone-200 text-xs">
            {t(`categories.${product.fields.Category}`, product.fields.Category)}
          </Badge>
        ) : (
          <span className="text-stone-400 text-sm">—</span>
        )}
      </TableCell>

      {/* Stock - with visual indicator */}
      <TableCell className="py-2 text-right pr-4">
        <div className="flex flex-col items-end gap-1">
          {/* Stock number with color coding */}
          <span className={`font-bold text-base tabular-nums ${STOCK_STATUS_COLORS[stockStatus]}`}>
            {currentStock}
          </span>

          {/* Progress bar indicator - reaches 100% at 1.5x minStock threshold */}
          {minStock > 0 && (
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${STOCK_BAR_COLORS[stockStatus]}`}
                style={{
                  width: `${Math.min(100, (currentStock / (minStock * 1.5)) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Status label */}
          {minStock > 0 && (
            <StockStatusLabel status={stockStatus} t={t} />
          )}
        </div>
      </TableCell>

      {/* Price - right aligned */}
      <TableCell className="py-2 text-right pr-4">
        {displayPrice != null ? (
          <span className="font-semibold text-stone-900 text-sm tabular-nums">
            €{displayPrice.toFixed(2)}
          </span>
        ) : (
          <span className="text-stone-400 text-sm">—</span>
        )}
      </TableCell>

      {/* Actions - 44px touch targets */}
      {(onQuickAdjust || onEdit || onDelete) && (
        <TableCell className="py-2" onClick={stopPropagation}>
          <div className="flex items-center gap-1 justify-center">
            {/* Quick Adjust - Always visible, 44px touch target */}
            {onQuickAdjust && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-10 sm:w-10 border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
                  onClick={() => onQuickAdjust(product.id, -1)}
                  disabled={isLoading || currentStock === 0}
                  aria-label={t('inventory.table.removeUnit')}
                >
                  {isLoading ? <LoadingSpinner /> : <Minus className="h-5 w-5 sm:h-4 sm:w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-10 sm:w-10 border-2 border-stone-300 hover:bg-stone-100 hover:border-stone-400 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
                  onClick={() => onQuickAdjust(product.id, 1)}
                  disabled={isLoading}
                  aria-label={t('inventory.table.addUnit')}
                >
                  {isLoading ? <LoadingSpinner /> : <Plus className="h-5 w-5 sm:h-4 sm:w-4" />}
                </Button>
              </div>
            )}

            {/* Edit and Delete - Compact but still 44px touch target */}
            {(onEdit || onDelete) && (
              <div className="flex items-center gap-1 ml-1">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-10 sm:w-10 text-stone-500 hover:text-stone-900 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-[var(--color-lavender)]"
                    onClick={onEdit}
                    aria-label={t('inventory.table.editProduct')}
                  >
                    <Edit2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 sm:h-10 sm:w-10 text-stone-500 hover:text-[var(--color-terracotta)] hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-[var(--color-terracotta)]"
                    onClick={onDelete}
                    aria-label={t('inventory.table.deleteProduct')}
                  >
                    <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for fine-grained re-render control
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.fields['Current Stock Level'] === nextProps.product.fields['Current Stock Level'] &&
    prevProps.product.fields['Min Stock Level'] === nextProps.product.fields['Min Stock Level'] &&
    prevProps.product.fields.Name === nextProps.product.fields.Name &&
    prevProps.product.fields.Category === nextProps.product.fields.Category &&
    prevProps.product.fields.Barcode === nextProps.product.fields.Barcode &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.selectedProductIds === nextProps.selectedProductIds
  );
});

ProductRow.displayName = 'ProductRow';

const InventoryTableComponent = ({
  products,
  onViewDetails,
  onQuickAdjust,
  onEdit,
  onDelete,
  selectedProductIds,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteSelected,
  loadingProductIds = EMPTY_LOADING_SET,
}: InventoryTableProps) => {
  const { t } = useTranslation();
  const selectedCount = selectedProductIds?.size ?? 0;
  const allSelected = Boolean(
    selectedProductIds &&
    products.length > 0 &&
    products.every((product) => selectedProductIds.has(product.id))
  );
  const someSelected = Boolean(
    selectedProductIds &&
    products.some((product) => selectedProductIds.has(product.id))
  );

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border-2 border-stone-200">
        <Package className="h-16 w-16 text-stone-300 mb-4" />
        <h3 className="text-lg font-bold text-stone-900 mb-2">{t('inventory.noProducts')}</h3>
        <p className="text-stone-500 text-sm max-w-md">
          {t('inventory.adjustFilters')}
        </p>
        <p className="text-xs text-stone-400 mt-3">
          {t('inventory.emptyStateHint', 'Try removing filters or importing products from an Excel file')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-stone-200 bg-white overflow-hidden">
      {selectedCount > 0 && onDeleteSelected && (
        <div className="flex items-center justify-between border-b-2 border-stone-200 bg-stone-50/80 px-4 py-2">
          <span className="text-sm font-semibold text-stone-700">
            {t('inventory.table.selectedCount', '{{count}} selected', { count: selectedCount })}
          </span>
          <Button
            size="sm"
            onClick={onDeleteSelected}
            className="h-9 font-semibold text-white"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-terracotta), var(--color-terracotta-dark))',
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('inventory.table.deleteSelected', 'Delete Selected')}
          </Button>
        </div>
      )}
      <div className="max-h-[calc(100dvh-290px)] overflow-y-auto">
        <Table stickyHeader>
          <TableHeader className="sticky top-0 z-10 bg-gradient-to-br from-stone-50 to-stone-100">
            <TableRow className="border-b-2 border-stone-200">
              <TableHead className={`w-[48px] ${HEADER_CELL_CLASS}`}>
                {onToggleSelectAll && selectedProductIds && (
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                      aria-label={t('inventory.table.selectAll', 'Select all')}
                    />
                  </div>
                )}
              </TableHead>
              <TableHead className={`w-[64px] ${HEADER_CELL_CLASS}`}>{t('inventory.table.image')}</TableHead>
              <TableHead className={`min-w-[200px] ${HEADER_CELL_CLASS}`}>{t('inventory.table.product')}</TableHead>
              <TableHead className={HEADER_CELL_CLASS}>{t('inventory.table.category')}</TableHead>
              <TableHead className={`text-right pr-4 ${HEADER_CELL_CLASS}`}>{t('inventory.table.stock')}</TableHead>
              <TableHead className={`text-right pr-4 ${HEADER_CELL_CLASS}`}>{t('inventory.table.price')}</TableHead>
              {(onQuickAdjust || onEdit || onDelete) && (
                <TableHead className={`text-center w-[180px] ${HEADER_CELL_CLASS}`}>
                  {t('inventory.table.actions')}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => {
              const currentStock = product.fields['Current Stock Level'] ?? 0;
              const minStock = product.fields['Min Stock Level'] ?? 0;
              const stockStatus = getStockStatus(currentStock, minStock);
              const isLowStock = stockStatus === 'low';
              const imageUrl = product.fields.Image?.[0]?.url;
              const isLoading = loadingProductIds.has(product.id);
              const displayPrice = getProductDisplayPrice(product.fields);
              const hasBarcode = Boolean(product.fields.Barcode);

              // Create stable callbacks for this row using useCallback
              // This ensures ProductRow's memo comparison works correctly
              const handleViewDetails = useCallback(() => onViewDetails(product), [product, onViewDetails]);
              const handleQuickAdjust = useCallback((delta: number) => onQuickAdjust?.(product.id, delta), [product.id, onQuickAdjust]);
              const handleEdit = useCallback(() => onEdit?.(product), [product, onEdit]);
              const handleDelete = useCallback(() => onDelete?.(product), [product, onDelete]);
              const handleToggleSelect = useCallback((selected: boolean) => onToggleSelect?.(product.id, selected), [product.id, onToggleSelect]);

              return (
                <ProductRow
                  key={product.id}
                  product={product}
                  index={index}
                  stockStatus={stockStatus}
                  isLowStock={isLowStock}
                  imageUrl={imageUrl}
                  isLoading={isLoading}
                  displayPrice={displayPrice}
                  hasBarcode={hasBarcode}
                  onViewDetails={handleViewDetails}
                  onQuickAdjust={onQuickAdjust ? handleQuickAdjust : undefined}
                  onEdit={onEdit ? handleEdit : undefined}
                  onDelete={onDelete ? handleDelete : undefined}
                  selectedProductIds={selectedProductIds}
                  onToggleSelect={onToggleSelect ? handleToggleSelect : undefined}
                  t={t}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const InventoryTable = memo(InventoryTableComponent);
