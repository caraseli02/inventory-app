import { useState, type FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import { useToast } from '../hooks/useToast';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';
import ProductSkeleton from '../components/product/ProductSkeleton';
import { ProductNotFound } from '../components/product/ProductNotFound';
import { PageHeader } from '../components/ui/PageHeader';
import {
  ShoppingCartIcon,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductSearchDropdown } from '../components/search/ProductSearchDropdown';
import { InputModeToggle, type InputMode } from '../components/search/InputModeToggle';
import type { Product } from '../types';

type ScanPageProps = {
  onBack: () => void;
};

const ScanPage = ({ onBack }: ScanPageProps) => {
  const { t } = useTranslation();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showCreateMode, setShowCreateMode] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('search');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { showToast } = useToast();

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  // Handle lookup errors (network, auth, etc.)
  useEffect(() => {
    if (error && scannedCode) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(
        'error',
        t('toast.lookupFailed'),
        errorMessage || t('toast.lookupFailedMessage'),
        5000
      );
      // Reset after showing error
      const timer = setTimeout(() => {
        setScannedCode(null);
        setManualCode('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error, scannedCode, showToast, t]);

  // Product not found is now handled by CreateProductForm in add mode
  // In unified interface, user can see stock level and choose whether to add or remove

  const handleReset = () => {
    setScannedCode(null);
    setManualCode('');
    setShowCreateMode(false);
    setSelectedProduct(null);
  };

  const handleTryAgain = () => {
    setScannedCode(null);
    setManualCode('');
    setShowCreateMode(false);
    setSelectedProduct(null);
  };

  const handleAddNew = () => {
    setShowCreateMode(true);
  };

  // Handle product selection from search dropdown
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setScannedCode(null);
    setShowCreateMode(false);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = manualCode.trim();
    // Allow manual codes of 4+ chars (custom codes) or standard barcode lengths (8, 12, 13)
    if (code.length >= 4) {
      handleScanSuccess(code);
    }
  };

  // State logic for displaying different views
  const productNotFound = !isLoading && !product && !error && scannedCode;
  const showNotFoundState = productNotFound && !showCreateMode;
  const showCreateForm = productNotFound && showCreateMode;
  const showDetailFromScan = !isLoading && product && scannedCode;
  const showDetailFromSearch = selectedProduct !== null;
  const showDetail = showDetailFromScan || showDetailFromSearch;
  const hasActiveProduct = scannedCode || selectedProduct;

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader
          title={showCreateForm ? t('product.newProduct') : showDetail ? t('product.manageStock') : showNotFoundState ? t('scan.productNotFound', 'Product Not Found') : t('scanner.title')}
          onBack={onBack}
        />

        {/* Input Section */}
        {!hasActiveProduct && (
          <div className="px-6 pt-4 space-y-4">
            {/* Mode Toggle */}
            <div className="flex justify-center">
              <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
            </div>

            {/* Search Mode */}
            {inputMode === 'search' && (
              <div className="mx-auto w-full max-w-lg">
                <ProductSearchDropdown
                  onProductSelect={handleProductSelect}
                  placeholder={t('search.scanPagePlaceholder', 'Search by name or barcode...')}
                  autoFocus
                />
              </div>
            )}

            {/* Scan Mode */}
            {inputMode === 'scan' && (
              <>
                {/* Scanner Frame - Scanner component includes built-in ScannerOverlay */}
                <div className="relative mx-auto w-full max-w-sm">
                  <div className="relative bg-black rounded-xl overflow-hidden">
                    <Scanner onScanSuccess={handleScanSuccess} scannerId="add-mobile-reader" />
                  </div>
                </div>

                {/* Manual Entry */}
                <div className="mx-auto w-full max-w-lg">
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 min-w-0 h-12 bg-white border-2 border-stone-300 rounded-lg px-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-700/10"
                      placeholder={t('scanner.manualEntry')}
                    />
                    <Button
                      type="submit"
                      disabled={manualCode.length < 3}
                      className={`flex-shrink-0 h-12 px-6 font-medium transition-colors ${
                        manualCode.length >= 3
                          ? 'bg-stone-900 hover:bg-stone-800 text-white'
                          : 'bg-stone-200 text-stone-700 cursor-not-allowed'
                      }`}
                    >
                      {t('scanner.addButton')}
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

        {/* Content Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out overflow-hidden z-50 ${
            hasActiveProduct ? 'h-[calc(100dvh-73px)]' : 'h-auto rounded-t-3xl'
          }`}
        >
          {!hasActiveProduct ? (
            /* Empty State - Collapsed */
            <div className="p-6 flex items-center justify-center">
              <div className="flex items-center gap-3 text-gray-500">
                <ShoppingCartIcon className="h-5 w-5 opacity-50" />
                <p className="text-sm">{t('scanner.emptyState')}</p>
              </div>
            </div>
          ) : (
            /* Content - Full screen without border/shadow */
            <div className="h-full overflow-y-auto p-4">
              {isLoading && scannedCode && <ProductSkeleton />}
              {showDetailFromScan && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
              {showDetailFromSearch && selectedProduct && <ProductDetail productId={selectedProduct.id} onScanNew={handleReset} />}
              {showNotFoundState && scannedCode && (
                <ProductNotFound
                  barcode={scannedCode}
                  onTryAgain={handleTryAgain}
                  onAddNew={handleAddNew}
                />
              )}
              {showCreateForm && scannedCode && <CreateProductForm barcode={scannedCode} onSuccess={handleReset} onCancel={handleReset} />}
            </div>
          )}
        </div>
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200">
        <PageHeader
          title={showCreateForm ? t('product.newProduct') : showDetail ? t('product.manageStock') : showNotFoundState ? t('scan.productNotFound', 'Product Not Found') : t('scanner.title')}
          onBack={onBack}
        />

        {/* Two-Column Layout - Input section hidden when product is active */}
        <div className="flex h-[calc(100dvh-64px)] gap-6 p-6">
          {/* Left Column: Input (only visible when no active product) */}
          {!hasActiveProduct && (
            <div className="w-[40%] flex flex-col gap-4">
              {/* Mode Toggle */}
              <div className="flex justify-center">
                <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
              </div>

              {/* Search Mode */}
              {inputMode === 'search' && (
                <div className="w-full">
                  <ProductSearchDropdown
                    onProductSelect={handleProductSelect}
                    placeholder={t('search.scanPagePlaceholder', 'Search by name or barcode...')}
                    autoFocus
                  />
                </div>
              )}

              {/* Scan Mode */}
              {inputMode === 'scan' && (
                <>
                  {/* Scanner Frame - Scanner component includes built-in ScannerOverlay */}
                  <div className="relative mx-auto w-full max-w-md">
                    <div className="relative bg-black rounded-xl overflow-hidden">
                      <Scanner onScanSuccess={handleScanSuccess} scannerId="add-desktop-reader" />
                    </div>
                  </div>

                  {/* Manual Entry */}
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 min-w-0 h-12 bg-white border-2 border-stone-300 rounded-lg px-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-700/10"
                      placeholder={t('scanner.manualEntry')}
                    />
                    <Button
                      type="submit"
                      disabled={manualCode.length < 3}
                      className={`flex-shrink-0 h-12 px-6 font-medium transition-colors ${
                        manualCode.length >= 3
                          ? 'bg-stone-900 hover:bg-stone-800 text-white'
                          : 'bg-stone-200 text-stone-700 cursor-not-allowed'
                      }`}
                    >
                      {t('scanner.addButton')}
                    </Button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* Right Column: Panel (expands to full width when input section is hidden) */}
          <div className={`${hasActiveProduct ? 'w-full' : 'w-[60%]'} bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
            {!hasActiveProduct ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <ShoppingCartIcon className="h-16 w-16 text-stone-300 mb-4" />
                <p className="text-stone-600 font-medium">{t('scanner.emptyState')}</p>
                <p className="text-xs text-stone-400 mt-2">
                  {t('scanner.emptyStateHint', 'Scan a barcode or enter it manually to get started')}
                </p>
              </div>
            ) : (
              /* Content - Full height without footer */
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading && scannedCode && <ProductSkeleton />}
                {showDetailFromScan && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
                {showDetailFromSearch && selectedProduct && <ProductDetail productId={selectedProduct.id} onScanNew={handleReset} />}
                {showNotFoundState && scannedCode && (
                  <ProductNotFound
                    barcode={scannedCode}
                    onTryAgain={handleTryAgain}
                    onAddNew={handleAddNew}
                  />
                )}
                {showCreateForm && scannedCode && <CreateProductForm barcode={scannedCode} onSuccess={handleReset} onCancel={handleReset} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ScanPage;
