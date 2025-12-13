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

type ScanPageProps = {
  onBack: () => void;
};

const ScanPage = ({ onBack }: ScanPageProps) => {
  const { t } = useTranslation();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showCreateMode, setShowCreateMode] = useState(false);
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
  };

  const handleTryAgain = () => {
    setScannedCode(null);
    setManualCode('');
    setShowCreateMode(false);
  };

  const handleAddNew = () => {
    setShowCreateMode(true);
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
  const showDetail = !isLoading && product && scannedCode;

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader
          title={showCreateForm ? t('product.newProduct') : showDetail ? t('product.manageStock') : showNotFoundState ? t('scan.productNotFound', 'Product Not Found') : t('scanner.title')}
          onBack={onBack}
        />

        {/* Scanner Section */}
        {!scannedCode && (
          <div className="px-6 pt-4 space-y-4">
            {/* Scanner Frame */}
            <div className="relative mx-auto w-full max-w-lg min-h-[300px]">
              {/* Corner Brackets Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Top-Left Corner */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[var(--color-forest)] rounded-tl-lg" />
                {/* Top-Right Corner */}
                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[var(--color-forest)] rounded-tr-lg" />
                {/* Bottom-Left Corner */}
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[var(--color-forest)] rounded-bl-lg" />
                {/* Bottom-Right Corner */}
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[var(--color-forest)] rounded-br-lg" />

                {/* Scan Line - animated */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent animate-pulse" />
              </div>

              {/* Scanner Area - relative to define container height */}
              <div className="relative bg-black rounded-lg overflow-hidden">
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
                className="flex-1 h-12 bg-white border-2 border-stone-300 rounded-lg px-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-700/10"
                placeholder={t('scanner.manualEntry')}
              />
              <Button
                type="submit"
                disabled={manualCode.length < 3}
                className="h-12 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium"
              >
                {t('scanner.addButton')}
              </Button>
            </form>
          </div>

          </div>
        )}

        {/* Content Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out overflow-hidden z-50 ${
            scannedCode ? 'h-[calc(100dvh-73px)]' : 'h-auto rounded-t-3xl'
          }`}
        >
          {!scannedCode ? (
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
              {showDetail && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
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

        {/* Two-Column Layout - Scanner hidden when product is scanned */}
        <div className="flex h-[calc(100dvh-64px)] gap-6 p-6">
          {/* Left Column: Scanner (only visible when no scanned code) */}
          {!scannedCode && (
            <div className="w-[40%] flex flex-col gap-6">
              <div className="relative mx-auto w-full max-w-lg min-h-[300px]">
                {/* Corner Brackets Overlay */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  {/* Top-Left Corner */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[var(--color-forest)] rounded-tl-lg" />
                  {/* Top-Right Corner */}
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[var(--color-forest)] rounded-tr-lg" />
                  {/* Bottom-Left Corner */}
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[var(--color-forest)] rounded-bl-lg" />
                  {/* Bottom-Right Corner */}
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[var(--color-forest)] rounded-br-lg" />

                  {/* Scan Line - animated */}
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-forest)] to-transparent animate-pulse" />
                </div>

                {/* Scanner Area - relative to define container height */}
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <Scanner onScanSuccess={handleScanSuccess} scannerId="add-desktop-reader" />
                </div>
              </div>

              {/* Manual Entry */}
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <Input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 h-12 bg-white border-2 border-stone-300 rounded-lg px-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-700 focus:ring-2 focus:ring-stone-700/10"
                  placeholder={t('scanner.manualEntry')}
                />
                <Button
                  type="submit"
                  disabled={manualCode.length < 3}
                  className="h-12 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium"
                >
                  {t('scanner.addButton')}
                </Button>
              </form>
            </div>
          )}

          {/* Right Column: Panel (expands to full width when scanner hidden) */}
          <div className={`${scannedCode ? 'w-full' : 'w-[60%]'} bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
            {!scannedCode ? (
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
                {showDetail && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
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
