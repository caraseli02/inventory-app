import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Package } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { useInventoryList } from '../hooks/useInventoryList';
import { useLowStockAlerts } from '../hooks/useLowStockAlerts';
import { InventoryFiltersBar } from '../components/inventory/InventoryFilters';
import { ProductListItem } from '../components/inventory/ProductListItem';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { ProductDetailDialog } from '../components/inventory/ProductDetailDialog';
import { LowStockAlertsPanel } from '../components/inventory/LowStockAlertsPanel';
import EditProductDialog from '../components/product/EditProductDialog';
import DeleteConfirmDialog from '../components/product/DeleteConfirmDialog';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ImportDialog } from '../components/xlsx/ImportDialog';
import { InvoiceUploadDialog } from '../components/invoice/InvoiceUploadDialog';
import { exportToXlsx, type ExportProduct } from '../lib/xlsx';
import { addStockMovement, createProduct, getProductByBarcode } from '../lib/api-provider';
import type { ImportedProduct } from '../lib/xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/useToast';
import type { Product } from '../types';
import { logger } from '../lib/logger';

interface InventoryListPageProps {
  onBack: () => void;
}

const InventoryListPage = ({ onBack }: InventoryListPageProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    products,
    isLoading,
    error,
    refetch,
    filters,
    updateFilter,
    resetFilters,
    categories,
    totalProducts,
    filteredCount,
  } = useInventoryList();

  // Low stock alerts
  const { lowStockProducts, hasAlerts, error: lowStockError, isLoading: lowStockLoading } = useLowStockAlerts();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleViewDetails = useCallback((product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDetailDialogOpen(false);
    // Clear any existing timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    // Small delay before clearing to avoid flash
    closeTimeoutRef.current = setTimeout(() => setSelectedProduct(null), 200);
  }, []);

  const handleQuickAdjust = useCallback(async (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Prevent multiple simultaneous operations on the same product
    if (loadingProducts.has(productId)) return;

    // Data integrity check: ensure stock value is a valid number
    const stockValue = product.fields['Current Stock Level'];
    const currentStock = typeof stockValue === 'number' && Number.isFinite(stockValue)
      ? stockValue
      : 0;
    const type = delta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(delta);

    // Prevent negative stock
    if (type === 'OUT' && currentStock < quantity) {
      showToast(
        'error',
        t('product.insufficientStock'),
        t('product.cannotRemove', { quantity, available: currentStock }),
        4000
      );
      return;
    }

    // Add to loading set
    setLoadingProducts((prev) => new Set(prev).add(productId));

    // Get previous data for rollback
    const previousData = queryClient.getQueryData<Product[]>(['products', 'all']);

    // Optimistically update the cache
    queryClient.setQueryData<Product[]>(['products', 'all'], (oldData) => {
      if (!oldData) return oldData;

      return oldData.map((p) => {
        if (p.id !== productId) return p;

        const newStock = currentStock + delta;
        return {
          ...p,
          fields: {
            ...p.fields,
            'Current Stock Level': newStock,
          },
        };
      });
    });

    try {
      await addStockMovement(productId, quantity, type);

      const action = type === 'IN' ? t('toast.stockAdded') : t('toast.stockRemoved');
      showToast(
        'success',
        t('toast.stockUpdated'),
        t('toast.stockUpdatedMessage', { action, quantity, name: product.fields.Name }),
        3000
      );
    } catch (err) {
      // Log error with full context
      logger.error('Stock adjustment failed', {
        productId,
        productName: product.fields.Name,
        quantity,
        type,
        currentStock,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      // Rollback on error
      if (previousData) {
        queryClient.setQueryData(['products', 'all'], previousData);
      }

      const errorMessage = err instanceof Error ? err.message : t('errors.unknownError');
      showToast('error', t('toast.updateFailed'), errorMessage, 5000);
    } finally {
      // Remove from loading set
      setLoadingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [products, loadingProducts, queryClient, showToast, t]);

  const handleRefresh = useCallback(() => {
    refetch();
    showToast('success', t('inventory.refreshed'), t('inventory.dataRefreshed'), 2000);
  }, [refetch, showToast, t]);

  const handleEdit = useCallback((product: Product) => {
    setEditProduct(product);
  }, []);

  const handleDelete = useCallback((product: Product) => {
    setDeleteProduct(product);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    // Refresh the list after deletion
    refetch();
  }, [refetch]);

  // Show toast when low stock alerts are first displayed
  const handleAlertShown = useCallback(() => {
    showToast(
      'warning',
      t('alerts.lowStockWarning', 'Low Stock Warning'),
      t('alerts.lowStockMessage', '{{count}} products need reordering. Check the alerts panel above.', {
        count: lowStockProducts.length,
      }),
      6000
    );
  }, [showToast, t, lowStockProducts.length]);

  // Handle viewing a product from the alerts panel
  const handleViewAlertProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  }, []);

  // Handle export to xlsx
  const handleExport = useCallback(() => {
    if (products.length === 0) return;

    try {
      // Map products to export format
      const exportProducts: ExportProduct[] = products.map((product) => ({
        Barcode: product.fields.Barcode,
        Name: product.fields.Name,
        Category: product.fields.Category,
        Price: product.fields.Price,
        price50: product.fields['Price 50%'],
        price70: product.fields['Price 70%'],
        price100: product.fields['Price 100%'],
        currentStock: product.fields['Current Stock Level'],
        minStock: product.fields['Min Stock Level'],
        Supplier: product.fields.Supplier,
        expiryDate: product.fields['Expiry Date'],
      }));

      // Generate and download xlsx file
      exportToXlsx(exportProducts);

      showToast(
        'success',
        t('export.success', 'Export Successful'),
        t('export.successMessage', { count: products.length }) + ' ' + t('export.downloadedHint', 'Check your Downloads folder.')
      );
    } catch (error) {
      showToast(
        'error',
        t('export.failed', 'Export Failed'),
        error instanceof Error ? error.message : t('errors.unknownError')
      );
    }
  }, [products, showToast, t]);

  // Handle import from xlsx
  const handleImport = useCallback(async (importedProducts: ImportedProduct[]) => {
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const failedProducts: Array<{ name: string; error: string }> = [];

    for (const imported of importedProducts) {
      try {
        // Check if product with this barcode already exists (only if barcode is provided)
        if (imported.Barcode) {
          const existing = await getProductByBarcode(imported.Barcode);
          if (existing) {
            // Skip duplicates for now (could add update logic later)
            skipCount++;
            continue;
          }
        }

        // Create new product with base price and all markup tiers
        const newProduct = await createProduct({
          Name: imported.Name,
          Barcode: imported.Barcode, // May be undefined
          Category: imported.Category,
          Price: imported.Price, // Base price (Pret euro)
          'Price 50%': imported.price50,
          'Price 70%': imported.price70,
          'Price 100%': imported.price100,
          Markup: 70, // Default markup percentage
          'Expiry Date': imported.expiryDate,
        });

        // Add initial stock if provided (use returned product ID directly)
        if (imported.currentStock && imported.currentStock > 0 && newProduct) {
          await addStockMovement(newProduct.id, imported.currentStock, 'IN');
        }

        successCount++;
      } catch (err) {
        // Log error with proper context
        logger.error('Product import failed', {
          productName: imported.Name,
          barcode: imported.Barcode,
          errorMessage: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
          timestamp: new Date().toISOString(),
        });

        // Track failed products for user notification
        failedProducts.push({
          name: imported.Name,
          error: err instanceof Error ? err.message : t('errors.unknownError'),
        });
        errorCount++;
      }
    }

    // Refresh the product list
    await refetch();

    // Show result toast with detailed error information
    if (successCount > 0) {
      let message = t('import.successMessage', { count: successCount, skipped: skipCount, errors: errorCount });

      // Append failed products details if any
      if (failedProducts.length > 0) {
        const failedList = failedProducts.slice(0, 3).map(f => `• ${f.name}: ${f.error}`).join('\n');
        const remaining = failedProducts.length > 3 ? `\n... and ${failedProducts.length - 3} more` : '';
        message += `\n\n${t('import.failedProducts', 'Failed products')}:\n${failedList}${remaining}`;
      }

      showToast(
        errorCount > 0 ? 'warning' : 'success',
        t('import.success'),
        message,
        8000
      );
    } else if (skipCount > 0) {
      showToast(
        'info',
        t('import.allSkipped'),
        t('import.allSkippedMessage', { count: skipCount }),
        5000
      );
    } else {
      let message = t('import.failedMessage', { count: errorCount });

      // Show failed products details
      if (failedProducts.length > 0) {
        const failedList = failedProducts.slice(0, 3).map(f => `• ${f.name}: ${f.error}`).join('\n');
        const remaining = failedProducts.length > 3 ? `\n... and ${failedProducts.length - 3} more` : '';
        message += `\n\n${failedList}${remaining}`;
      }

      showToast(
        'error',
        t('import.failed'),
        message,
        8000
      );
    }
  }, [refetch, showToast, t]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
      <PageHeader
        title={t('inventory.title')}
        onBack={onBack}
      />

      <div className="h-[calc(100dvh-64px)] overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Low Stock Alerts Panel */}
          <ErrorBoundary>
            {hasAlerts && !isLoading && !lowStockLoading && !lowStockError && (
              <LowStockAlertsPanel
                lowStockProducts={lowStockProducts}
                onViewProduct={handleViewAlertProduct}
                onAlertShown={handleAlertShown}
              />
            )}
            {/* Error state for low stock alerts */}
            {lowStockError && !lowStockLoading && (
              <div className="bg-stone-100 rounded-2xl border-2 border-stone-300 p-4 text-center">
                <p className="text-stone-600 text-sm">
                  {t('alerts.loadError', 'Unable to check stock levels')}
                </p>
              </div>
            )}
          </ErrorBoundary>

          {/* Filters */}
          <InventoryFiltersBar
            filters={filters}
            categories={categories}
            totalProducts={totalProducts}
            filteredCount={filteredCount}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            onRefresh={handleRefresh}
            isRefreshing={isLoading}
            onImport={() => setImportDialogOpen(true)}
            onImportInvoice={() => setInvoiceDialogOpen(true)}
            onExport={handleExport}
          />

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label={t('inventory.loading')} />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-white rounded-2xl border-2 border-[var(--color-terracotta)] p-8 text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                {t('inventory.failedToLoad')}
              </h3>
              <p className="text-stone-600 mb-4">
                {error instanceof Error ? error.message : t('errors.unknownError')}
              </p>
              <Button
                onClick={handleRefresh}
                className="bg-stone-900 hover:bg-stone-800 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('inventory.tryAgain')}
              </Button>
            </div>
          )}

          {/* Mobile View - Cards */}
          {!isLoading && !error && (
            <>
              <div className="md:hidden space-y-3">
                {products.length > 0 ? (
                  products.map((product) => (
                    <ProductListItem
                      key={product.id}
                      product={product}
                      onViewDetails={handleViewDetails}
                      onQuickAdjust={handleQuickAdjust}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isLoading={loadingProducts.has(product.id)}
                    />
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-stone-200 p-12 text-center">
                    <Package className="h-24 w-24 text-stone-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      {t('inventory.noProducts')}
                    </h3>
                    <p className="text-stone-600">
                      {t('inventory.adjustFilters')}
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop/Tablet View - Table */}
              <div className="hidden md:block">
                <InventoryTable
                  products={products}
                  onViewDetails={handleViewDetails}
                  onQuickAdjust={handleQuickAdjust}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  loadingProductIds={loadingProducts}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product Detail Dialog */}
      <ErrorBoundary>
        <ProductDetailDialog
          product={selectedProduct}
          open={detailDialogOpen}
          onClose={handleCloseDialog}
          onEdit={handleEdit}
        />
      </ErrorBoundary>

      {/* Edit Product Dialog */}
      {editProduct && (
        <EditProductDialog
          product={editProduct}
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteProduct && (
        <DeleteConfirmDialog
          product={deleteProduct}
          open={!!deleteProduct}
          onOpenChange={(open) => !open && setDeleteProduct(null)}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />

      {/* Invoice Upload Dialog */}
      <ErrorBoundary>
        <InvoiceUploadDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          onImport={handleImport}
        />
      </ErrorBoundary>
    </div>
  );
};

export default InventoryListPage;
