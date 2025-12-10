import { useState, type FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import { useToast } from '../hooks/useToast';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';
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
  }, [error, scannedCode, showToast]);

  // Product not found is now handled by CreateProductForm in add mode
  // In unified interface, user can see stock level and choose whether to add or remove

  const handleReset = () => {
    setScannedCode(null);
    setManualCode('');
  };


  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
    }
  };

  // Show create form when product not found (unified interface allows adding new products)
  const showCreateForm = !isLoading && !product && !error && scannedCode;
  const showDetail = !isLoading && product && scannedCode;

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader
          title={showCreateForm ? t('product.newProduct') : showDetail ? t('product.manageStock') : t('scanner.title')}
          onBack={onBack}
        />

        {/* Scanner Section */}
        {!scannedCode && (
          <div className="px-6 pt-4 space-y-4">
            {/* Scanner Frame */}
            <div className="relative mx-auto w-full max-w-lg aspect-square">
              {/* Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-stone-700" />
                <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-stone-700" />
                <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-stone-700" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-stone-700" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-700 shadow-lg" />
              </div>

              {/* Scanner Area */}
              <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
                <Scanner onScanSuccess={handleScanSuccess} scannerId="add-mobile-reader" />
              </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-10 w-10 border-4 border-stone-200 border-t-stone-700 rounded-full" />
                  <p className="text-stone-900 text-sm font-medium">{t('scanner.searching')}</p>
                </div>
              </div>
            )}
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
            <div className="h-full overflow-y-auto">
              {showDetail && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
              {showCreateForm && scannedCode && <CreateProductForm barcode={scannedCode} onSuccess={handleReset} onCancel={handleReset} />}
            </div>
          )}
        </div>
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200">
        <PageHeader
          title={showCreateForm ? t('product.newProduct') : showDetail ? t('product.manageStock') : t('scanner.title')}
          onBack={onBack}
        />

        {/* Two-Column Layout - Scanner hidden when product is scanned */}
        <div className="flex h-[calc(100dvh-64px)] gap-6 p-6">
          {/* Left Column: Scanner (only visible when no scanned code) */}
          {!scannedCode && (
            <div className="w-[45%] flex flex-col gap-6">
              <div className="relative mx-auto w-full max-w-lg aspect-square">
                {/* Corner Brackets */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-stone-700" />
                  <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-stone-700" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-stone-700" />
                  <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-stone-700" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-700 shadow-lg" />
                </div>

                {/* Scanner Area */}
                <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
                  <Scanner onScanSuccess={handleScanSuccess} scannerId="add-desktop-reader" />
                </div>

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin h-10 w-10 border-4 border-stone-200 border-t-stone-700 rounded-full" />
                    <p className="text-stone-900 text-sm font-medium">{t('scanner.searching')}</p>
                  </div>
                </div>
              )}
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
          <div className={`${scannedCode ? 'w-full' : 'w-[55%]'} bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
            {!scannedCode ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <ShoppingCartIcon className="h-16 w-16 opacity-20 mb-3 text-gray-400" />
                <p className="text-sm text-gray-500">{t('scanner.emptyState')}</p>
              </div>
            ) : (
              /* Content - Full height without footer */
              <div className="flex-1 overflow-y-auto">
                {showDetail && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
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
