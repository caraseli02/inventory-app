import { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Spinner } from '../components/ui/spinner';
import { useInventoryList } from '../hooks/useInventoryList';
import { InventoryFiltersBar } from '../components/inventory/InventoryFilters';
import { ProductListItem } from '../components/inventory/ProductListItem';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { ProductDetailDialog } from '../components/inventory/ProductDetailDialog';
import { addStockMovement } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/useToast';
import type { Product } from '../types';

interface InventoryListPageProps {
  onBack: () => void;
}

const InventoryListPage = ({ onBack }: InventoryListPageProps) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());
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

    const currentStock = product.fields['Current Stock Level'] ?? 0;
    const type = delta > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(delta);

    // Prevent negative stock
    if (type === 'OUT' && currentStock < quantity) {
      showToast(
        'error',
        'Insufficient Stock',
        `Cannot remove ${quantity} unit(s). Only ${currentStock} unit(s) available.`,
        4000
      );
      return;
    }

    // Add to loading set
    setLoadingProducts((prev) => new Set(prev).add(productId));

    try {
      await addStockMovement(productId, quantity, type);

      // Invalidate queries to refetch updated data
      await queryClient.invalidateQueries({ queryKey: ['products', 'all'] });

      showToast(
        'success',
        'Stock Updated',
        `${type === 'IN' ? 'Added' : 'Removed'} ${quantity} unit(s) for ${product.fields.Name}`,
        3000
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update stock';
      showToast('error', 'Update Failed', errorMessage, 5000);
    } finally {
      // Remove from loading set
      setLoadingProducts((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [products, loadingProducts, queryClient, showToast]);

  const handleRefresh = useCallback(() => {
    refetch();
    showToast('success', 'Refreshed', 'Inventory data refreshed', 2000);
  }, [refetch, showToast]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
      <PageHeader
        title="Inventory List"
        onBack={onBack}
      />

      <div className="h-[calc(100dvh-64px)] overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
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
          />

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" label="Loading inventory..." />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-white rounded-2xl border-2 border-[var(--color-terracotta)] p-8 text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                Failed to Load Inventory
              </h3>
              <p className="text-stone-600 mb-4">
                {error instanceof Error ? error.message : 'Unknown error occurred'}
              </p>
              <Button
                onClick={handleRefresh}
                className="bg-stone-900 hover:bg-stone-800 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
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
                      isLoading={loadingProducts.has(product.id)}
                    />
                  ))
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-stone-200 p-12 text-center">
                    <div className="text-6xl mb-4">📦</div>
                    <h3 className="text-xl font-bold text-stone-900 mb-2">
                      No products found
                    </h3>
                    <p className="text-stone-600">
                      Try adjusting your filters or search query
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
                  loadingProductIds={loadingProducts}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={selectedProduct}
        open={detailDialogOpen}
        onClose={handleCloseDialog}
      />
    </div>
  );
};

export default InventoryListPage;
