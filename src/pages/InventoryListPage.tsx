import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Package } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { useInventoryList } from '../hooks/useInventoryList';
import { useLowStockAlerts } from '../hooks/useLowStockAlerts';
import { useQuickStockAdjust } from '../hooks/useQuickStockAdjust';
import { useProductImport } from '../hooks/useProductImport';
import { InventoryFiltersBar } from '../components/inventory/InventoryFilters';
import { ProductListItem } from '../components/inventory/ProductListItem';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { ProductDetailDialog } from '../components/inventory/ProductDetailDialog';
import { LowStockAlertsPanel } from '../components/inventory/LowStockAlertsPanel';
import EditProductDialog from '../components/product/EditProductDialog';
import DeleteConfirmDialog from '../components/product/DeleteConfirmDialog';
import BatchDeleteConfirmDialog from '../components/product/BatchDeleteConfirmDialog';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ImportDialog } from '../components/xlsx/ImportDialog';
import { InvoiceUploadDialog } from '../components/invoice/InvoiceUploadDialog';
import { exportToXlsx, type ExportProduct } from '../lib/xlsx';
import { useToast } from '../hooks/useToast';
import type { Product } from '../types';

interface InventoryListPageProps {
  onBack: () => void;
}

const InventoryListPage = ({ onBack }: InventoryListPageProps) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    products,
    allProducts,
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

  const { lowStockProducts, hasAlerts, error: lowStockError, isLoading: lowStockLoading } =
    useLowStockAlerts();

  const { handleQuickAdjust, loadingProducts } = useQuickStockAdjust(products);
  const { handleImport } = useProductImport({ allProducts, refetch });

  // Derive valid selection: filter out IDs that no longer exist in the current product list
  const selectedProductIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds;
    const productIdSet = new Set(products.map((p) => p.id));
    const filtered = new Set([...rawSelectedIds].filter((id) => productIdSet.has(id)));
    return filtered.size === rawSelectedIds.size ? rawSelectedIds : filtered;
  }, [products, rawSelectedIds]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleViewDetails = useCallback((product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDetailDialogOpen(false);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setSelectedProduct(null), 200);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
    showToast('success', t('inventory.refreshed'), t('inventory.dataRefreshed'), 2000);
  }, [refetch, showToast, t]);

  const handleEdit = useCallback((product: Product) => setEditProduct(product), []);
  const handleDelete = useCallback((product: Product) => setDeleteProduct(product), []);
  const handleDeleteSuccess = useCallback(() => { refetch(); }, [refetch]);

  const handleToggleSelect = useCallback((productId: string, selected: boolean) => {
    setRawSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(productId); else next.delete(productId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((selected: boolean) => {
    setRawSelectedIds(() =>
      selected ? new Set(products.map((product) => product.id)) : new Set()
    );
  }, [products]);

  const handleBatchDeleteSuccess = useCallback((deletedIds: string[], failedIds: string[]) => {
    setRawSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      failedIds.forEach((id) => next.add(id));
      return next;
    });
    refetch();
  }, [refetch]);

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

  const handleViewAlertProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  }, []);

  const handleExport = useCallback(() => {
    if (products.length === 0) return;
    try {
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
      exportToXlsx(exportProducts);
      showToast(
        'success',
        t('export.success', 'Export Successful'),
        t('export.successMessage', { count: products.length }) + ' ' +
          t('export.downloadedHint', 'Check your Downloads folder.')
      );
    } catch (error) {
      showToast(
        'error',
        t('export.failed', 'Export Failed'),
        error instanceof Error ? error.message : t('errors.unknownError')
      );
    }
  }, [products, showToast, t]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
      <PageHeader title={t('inventory.title')} onBack={onBack} />

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
            {lowStockError && !lowStockLoading && (
              <div className="bg-stone-100 rounded-2xl border-2 border-stone-300 p-4 text-center">
                <p className="text-stone-600 text-sm">
                  {t('alerts.loadError', 'Unable to check stock levels')}
                </p>
              </div>
            )}
          </ErrorBoundary>

          {/* Filters */}
          <div className="sticky top-0 z-20 -mx-6 px-6 pt-4 pb-3 bg-gradient-to-br from-stone-100/95 to-stone-200/95 backdrop-blur border-b-2 border-stone-200">
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
          </div>

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
              <Button onClick={handleRefresh} className="bg-stone-900 hover:bg-stone-800 text-white">
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
                    <p className="text-stone-600">{t('inventory.adjustFilters')}</p>
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
                  selectedProductIds={selectedProductIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onDeleteSelected={() => setBatchDeleteOpen(true)}
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

      {/* Batch Delete Dialog */}
      <BatchDeleteConfirmDialog
        products={products.filter((product) => selectedProductIds.has(product.id))}
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        onDeleteSuccess={handleBatchDeleteSuccess}
      />

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
          products={allProducts}
        />
      </ErrorBoundary>
    </div>
  );
};

export default InventoryListPage;
