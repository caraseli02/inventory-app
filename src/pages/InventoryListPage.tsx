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
import BatchDeleteConfirmDialog from '../components/product/BatchDeleteConfirmDialog';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ImportDialog } from '../components/xlsx/ImportDialog';
import { InvoiceUploadDialog } from '../components/invoice/InvoiceUploadDialog';
import { exportToXlsx, type ExportProduct } from '../lib/xlsx';
import { addStockMovement, createProduct, getProductByBarcode, updateProduct } from '../lib/api-provider';
import type { ImportedProduct } from '../lib/xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/useToast';
import type { Product } from '../types';
import { logger } from '../lib/logger';
import { AuthorizationError, NetworkError } from '../lib/errors';
import { buildInvoiceRowNote, getAlreadyImportedRowIds } from '../lib/invoiceIdempotency';
import { buildInvoiceProductUpdatePayload } from '../lib/invoiceImportDiffs';

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
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quickAdjustLocksRef = useRef<Set<string>>(new Set());

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

  // Keep selection in sync with current products
  useEffect(() => {
    setSelectedProductIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      const productIds = new Set(products.map((product) => product.id));
      prev.forEach((id) => {
        if (productIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [products]);

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

    // Atomic check-and-lock to prevent fast double-taps from running concurrently.
    if (quickAdjustLocksRef.current.has(productId)) {
      logger.debug('Prevented concurrent quick adjust', { productId });
      return;
    }
    quickAdjustLocksRef.current.add(productId);

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
      quickAdjustLocksRef.current.delete(productId);
    }
  }, [products, queryClient, showToast, t]);

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

  const handleToggleSelect = useCallback((productId: string, selected: boolean) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((selected: boolean) => {
    setSelectedProductIds(() => {
      if (!selected) return new Set();
      return new Set(products.map((product) => product.id));
    });
  }, [products]);

  const handleBatchDeleteSuccess = useCallback((deletedIds: string[], failedIds: string[]) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      failedIds.forEach((id) => next.add(id));
      return next;
    });
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
  const handleImport = useCallback(async (
    importedProducts: ImportedProduct[],
    onProgress?: (current: number, total: number) => void
  ) => {
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const failedProducts: Array<{ name: string; error: string }> = [];
    const partialProducts: Array<{ name: string; error: string }> = [];
    let processedCount = 0;
    const totalCount = importedProducts.length;

    const normalizeName = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizeBarcode = (value: string | undefined): string | undefined => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    const importSources = new Set(importedProducts.map((product) => product.importSource ?? 'xlsx'));
    if (importSources.size > 1) {
      logger.error('Mixed import sources in single batch', {
        importSources: Array.from(importSources),
        rowCount: importedProducts.length,
      });
      showToast(
        'error',
        t('import.failed'),
        t('import.mixedSourcesNotSupported', 'Import batch contains mixed sources. Please import invoice and XLSX files separately.'),
        8000
      );
      return;
    }

    const isInvoiceImport = importSources.has('invoice');
    if (isInvoiceImport) {
      const normalizedNameMap = new Map<string, Product>();
      const productById = new Map<string, Product>();
      let invoiceDuplicateSkipCount = 0;
      // IMPORTANT: build indices from the full inventory (not the filtered list),
      // otherwise invoice imports can create duplicates when filters are active.
      allProducts.forEach((product) => {
        const normalized = normalizeName(product.fields.Name);
        if (!normalizedNameMap.has(normalized)) {
          normalizedNameMap.set(normalized, product);
        }
        productById.set(product.id, product);
      });

      const firstInvoiceRow = importedProducts[0];
      let alreadyImportedRowIds = new Set<string>();
      if (firstInvoiceRow?.invoiceSupplier && firstInvoiceRow?.invoiceNumber) {
        try {
          alreadyImportedRowIds = await getAlreadyImportedRowIds({
            supplier: firstInvoiceRow.invoiceSupplier,
            invoiceNumber: firstInvoiceRow.invoiceNumber,
          });
        } catch (err) {
          logger.warn('Invoice import idempotency pre-check unavailable', {
            supplier: firstInvoiceRow.invoiceSupplier,
            invoiceNumber: firstInvoiceRow.invoiceNumber,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }

      for (const imported of importedProducts) {
        try {
          const importAction = imported.importAction ?? 'create';
          if (importAction === 'skip') {
            skipCount += 1;
            continue;
          }

          const importedRowId = imported.invoiceRowId?.trim();
          const isAlreadyImportedRow = Boolean(importedRowId && alreadyImportedRowIds.has(importedRowId));

          const stockNote = importedRowId
            ? buildInvoiceRowNote({
                supplier: imported.invoiceSupplier,
                invoiceNumber: imported.invoiceNumber,
                rowId: importedRowId,
              }) ?? undefined
            : undefined;

          const importedBarcode = normalizeBarcode(imported.Barcode);
          let existing: Product | null = null;

          // If the UI found a match, treat the ID as authoritative (works for update/receive_stock).
          if (imported.existingProductId) {
            existing = productById.get(imported.existingProductId) ?? null;
          }

          if (!existing && importedBarcode) {
            existing = await getProductByBarcode(importedBarcode);
          }
          // Skip name-based lookup when user explicitly chose 'create' — respects intent
          // for KG vrac items that share a generic name but are distinct products.
          if (!existing && importAction !== 'create') {
            existing = normalizedNameMap.get(normalizeName(imported.Name)) ?? null;
          }
          if (existing) {
            normalizedNameMap.set(normalizeName(imported.Name), existing);
            productById.set(existing.id, existing);
          }

          if (existing) {
            if (isAlreadyImportedRow && importAction === 'receive_stock') {
              skipCount += 1;
              invoiceDuplicateSkipCount += 1;
              continue;
            }

            if (importAction === 'receive_stock' && !imported.currentStock) {
              skipCount += 1;
              continue;
            }

            if (importAction === 'update') {
              const updatePayload = buildInvoiceProductUpdatePayload(existing, imported);
              if (Object.keys(updatePayload).length > 0) {
                const updated = await updateProduct(existing.id, updatePayload);
                existing = updated;
                normalizedNameMap.set(normalizeName(updated.fields.Name), updated);
                productById.set(updated.id, updated);
              }
            }

            if (imported.currentStock && imported.currentStock > 0 && !isAlreadyImportedRow) {
              try {
                await addStockMovement(existing.id, imported.currentStock, 'IN', stockNote);
                if (importedRowId) alreadyImportedRowIds.add(importedRowId);
              } catch (stockErr) {
                const stockErrorMessage = stockErr instanceof Error ? stockErr.message : t('errors.unknownError');
                partialProducts.push({
                  name: imported.Name,
                  error: t('import.partialStockFailed', {
                    defaultValue: 'Product processed, but stock movement failed: {{message}}',
                    message: stockErrorMessage,
                  }),
                });
                logger.error('Invoice import stock movement failed after product update', {
                  productId: existing.id,
                  productName: imported.Name,
                  quantity: imported.currentStock,
                  errorMessage: stockErrorMessage,
                  errorStack: stockErr instanceof Error ? stockErr.stack : undefined,
                  timestamp: new Date().toISOString(),
                });
                continue;
              }
            }
          } else {
            if (isAlreadyImportedRow) {
              skipCount += 1;
              invoiceDuplicateSkipCount += 1;
              continue;
            }

            if (importAction === 'receive_stock') {
              throw new Error(
                t('import.invoiceReceiveStockMatchMissing', {
                  defaultValue: 'Matched product no longer exists. Refresh inventory and try again.',
                })
              );
            }

            const newProduct = await createProduct({
              Name: imported.Name,
              Barcode: importedBarcode,
              Category: imported.Category,
              Price: imported.Price,
              'Price 50%': imported.price50,
              'Price 70%': imported.price70,
              'Price 100%': imported.price100,
              Markup: 70,
              'Expiry Date': imported.expiryDate,
              Supplier: imported.Supplier,
            });
            normalizedNameMap.set(normalizeName(imported.Name), newProduct);
            productById.set(newProduct.id, newProduct);

            if (imported.currentStock && imported.currentStock > 0 && newProduct) {
              try {
                await addStockMovement(newProduct.id, imported.currentStock, 'IN', stockNote);
                if (importedRowId) alreadyImportedRowIds.add(importedRowId);
              } catch (stockErr) {
                const stockErrorMessage = stockErr instanceof Error ? stockErr.message : t('errors.unknownError');
                partialProducts.push({
                  name: imported.Name,
                  error: t('import.partialStockFailed', {
                    defaultValue: 'Product created, but stock movement failed: {{message}}',
                    message: stockErrorMessage,
                  }),
                });
                logger.error('Invoice import stock movement failed after product creation', {
                  productId: newProduct.id,
                  productName: imported.Name,
                  quantity: imported.currentStock,
                  errorMessage: stockErrorMessage,
                  errorStack: stockErr instanceof Error ? stockErr.stack : undefined,
                  timestamp: new Date().toISOString(),
                });
                continue;
              }
            }
          }

          successCount += 1;
        } catch (err) {
          logger.error('Invoice import row failed', {
            productName: imported.Name,
            barcode: imported.Barcode,
            errorType: err instanceof Error ? err.constructor.name : typeof err,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorStack: err instanceof Error ? err.stack : undefined,
            timestamp: new Date().toISOString(),
          });
          errorCount += 1;
          failedProducts.push({
            name: imported.Name,
            error: err instanceof Error ? err.message : t('errors.unknownError'),
          });
        } finally {
          processedCount += 1;
          onProgress?.(processedCount, totalCount);
        }
      }

      await refetch();

      if (successCount > 0 || partialProducts.length > 0) {
        let message = t('import.successMessage', { count: successCount, skipped: skipCount, errors: errorCount });
        if (invoiceDuplicateSkipCount > 0) {
          message += `\n\n${t('import.invoiceAlreadyImportedSkipped', {
            count: invoiceDuplicateSkipCount,
            defaultValue: '{{count}} rows were skipped because they were already imported from this invoice.',
          })}`;
        }
        if (partialProducts.length > 0) {
          const partialList = partialProducts.slice(0, 3).map(f => `• ${f.name}: ${f.error}`).join('\n');
          const remainingPartial = partialProducts.length > 3 ? `\n... and ${partialProducts.length - 3} more` : '';
          message += `\n\n${t('import.partialProducts', 'Partially imported products')}:\n${partialList}${remainingPartial}`;
        }
        if (failedProducts.length > 0) {
          const failedList = failedProducts.slice(0, 3).map(f => `• ${f.name}: ${f.error}`).join('\n');
          const remaining = failedProducts.length > 3 ? `\n... and ${failedProducts.length - 3} more` : '';
          message += `\n\n${t('import.failedProducts', 'Failed products')}:\n${failedList}${remaining}`;
        }
        showToast(errorCount > 0 || partialProducts.length > 0 ? 'warning' : 'success', t('import.success'), message, 8000);
      } else {
        const message = failedProducts.length > 0
          ? failedProducts.slice(0, 3).map(f => `• ${f.name}: ${f.error}`).join('\n')
          : t('import.failedMessage', { count: errorCount });
        showToast(invoiceDuplicateSkipCount > 0 ? 'info' : 'error', t('import.failed'), message, 8000);
      }
      return;
    }

    for (const imported of importedProducts) {
      try {
        const importAction = imported.importAction ?? 'create';

        if (importAction === 'skip') {
          skipCount++;
          continue;
        }

        if (importAction === 'update' && imported.existingProductId) {
          await updateProduct(imported.existingProductId, {
            Name: imported.Name,
            Category: imported.Category,
            Price: imported.Price,
            'Price 70%': imported.price70,
            Markup: 70,
            Supplier: imported.Supplier,
            Image: imported.imageUrl,
          });

          if (imported.currentStock && imported.currentStock > 0) {
            await addStockMovement(imported.existingProductId, imported.currentStock, 'IN');
          }

          successCount++;
          continue;
        }

        const importedBarcode = normalizeBarcode(imported.Barcode);
        // Check if product with this barcode already exists (only if barcode is provided)
        if (importedBarcode) {
          const existing = await getProductByBarcode(importedBarcode);
          if (existing) {
            // Skip duplicates for create-only imports
            skipCount++;
            continue;
          }
        }

        // Create new product with base price and all markup tiers
        const newProduct = await createProduct({
          Name: imported.Name,
          Barcode: importedBarcode, // May be undefined
          Category: imported.Category,
          Price: imported.Price, // Base price (Pret euro)
          'Price 50%': imported.price50,
          'Price 70%': imported.price70,
          'Price 100%': imported.price100,
          Markup: 70, // Default markup percentage
          'Expiry Date': imported.expiryDate,
          Image: imported.imageUrl,
        });

        // Add initial stock if provided (use returned product ID directly)
        if (imported.currentStock && imported.currentStock > 0 && newProduct) {
          await addStockMovement(newProduct.id, imported.currentStock, 'IN');
        }

        successCount++;
      } catch (err) {
        // Check for fatal errors that should stop the import
        if (err instanceof AuthorizationError ||
            (err instanceof NetworkError && successCount === 0)) {
          logger.error('Fatal error during import - stopping', {
            productName: imported.Name,
            errorType: err.constructor.name,
            errorMessage: err.message,
            errorStack: err.stack,
            successCount,
            errorCount,
            remainingCount: importedProducts.length - successCount - errorCount,
          });

          showToast(
            'error',
            t('import.failed'),
            `Import stopped: ${err.message}. ${successCount} products were imported successfully.`,
            10000
          );
          return; // Stop the import
        }

        // Log validation and non-fatal errors
        logger.error('Product import failed', {
          productName: imported.Name,
          barcode: imported.Barcode,
          errorType: err instanceof Error ? err.constructor.name : typeof err,
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
      } finally {
        processedCount += 1;
        onProgress?.(processedCount, totalCount);
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
  }, [allProducts, refetch, showToast, t]);

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
