import { type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Scanner from '../components/scanner/Scanner';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';
import ProductSkeleton from '../components/product/ProductSkeleton';
import { ProductNotFound } from '../components/product/ProductNotFound';
import { PageHeader } from '../components/ui/PageHeader';
import { ShoppingCartIcon } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductSearchDropdown } from '../components/search/ProductSearchDropdown';
import { InputModeToggle, type InputMode } from '../components/search/InputModeToggle';
import { useScanState, type ScanState } from '../hooks/useScanState';
import type { Product } from '../types';

type ScanPageProps = {
  onBack: () => void;
};

function getScanPageTitle(
  showCreateForm: boolean,
  showDetail: boolean,
  showNotFoundState: boolean,
  t: TFunction,
): string {
  if (showCreateForm) return t('product.newProduct');
  if (showDetail) return t('product.manageStock');
  if (showNotFoundState) return t('scan.productNotFound', 'Product Not Found');
  return t('scanner.title');
}

interface ScanInputSectionProps {
  inputMode: InputMode;
  onProductSelect: (product: Product) => void;
  onScanSuccess: (code: string) => void;
  manualCode: string;
  setManualCode: (code: string) => void;
  onManualSubmit: (e: FormEvent<HTMLFormElement>) => void;
  scannerId: string;
}

function ScanInputSection({ inputMode, onProductSelect, onScanSuccess, manualCode, setManualCode, onManualSubmit, scannerId }: ScanInputSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      {inputMode === 'search' && (
        <div className="mx-auto w-full max-w-lg">
          <ProductSearchDropdown
            onProductSelect={onProductSelect}
            placeholder={t('search.scanPagePlaceholder', 'Search by name or barcode...')}
            autoFocus
          />
        </div>
      )}
      {inputMode === 'scan' && (
        <>
          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="relative bg-black rounded-xl overflow-hidden">
              <Scanner onScanSuccess={onScanSuccess} scannerId={scannerId} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-lg">
            <form onSubmit={onManualSubmit} className="flex gap-2">
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
                  manualCode.length >= 3 ? 'bg-stone-900 hover:bg-stone-800 text-white' : 'bg-stone-200 text-stone-700 cursor-not-allowed'
                }`}
              >
                {t('scanner.addButton')}
              </Button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

type ScanContentPanelProps = Pick<ScanState,
  'isLoading' | 'scannedCode' | 'selectedProduct' |
  'showDetailFromScan' | 'showDetailFromSearch' | 'showNotFoundState' | 'showCreateForm' |
  'handleReset' | 'handleTryAgain' | 'handleAddNew'
>;

function ScanContentPanel({ isLoading, scannedCode, selectedProduct, showDetailFromScan, showDetailFromSearch, showNotFoundState, showCreateForm, handleReset, handleTryAgain, handleAddNew }: ScanContentPanelProps) {
  return (
    <>
      {isLoading && scannedCode && <ProductSkeleton />}
      {showDetailFromScan && scannedCode && <ProductDetail barcode={scannedCode} onScanNew={handleReset} />}
      {showDetailFromSearch && selectedProduct && <ProductDetail productId={selectedProduct.id} onScanNew={handleReset} />}
      {showNotFoundState && scannedCode && (
        <ProductNotFound barcode={scannedCode} onTryAgain={handleTryAgain} onAddNew={handleAddNew} />
      )}
      {showCreateForm && scannedCode && <CreateProductForm barcode={scannedCode} onSuccess={handleReset} onCancel={handleReset} />}
    </>
  );
}

const ScanPage = ({ onBack }: ScanPageProps) => {
  const { t } = useTranslation();
  const state = useScanState();
  const { inputMode, setInputMode, hasActiveProduct, manualCode, setManualCode, handleScanSuccess, handleManualSubmit, handleProductSelect, showCreateForm, showDetail, showNotFoundState } = state;
  const title = getScanPageTitle(showCreateForm, showDetail, showNotFoundState, t);
  const contentPanelProps = { ...state };

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden">
        <PageHeader title={title} onBack={onBack} />
        {!hasActiveProduct && (
          <div className="px-6 pt-4 space-y-4">
            <div className="flex justify-center">
              <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
            </div>
            <ScanInputSection inputMode={inputMode} onProductSelect={handleProductSelect} onScanSuccess={handleScanSuccess} manualCode={manualCode} setManualCode={setManualCode} onManualSubmit={handleManualSubmit} scannerId="add-mobile-reader" />
          </div>
        )}
        <div className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out overflow-hidden z-50 ${hasActiveProduct ? 'h-[calc(100dvh-73px)]' : 'h-auto rounded-t-3xl'}`}>
          {!hasActiveProduct ? (
            <div className="p-6 flex items-center justify-center">
              <div className="flex items-center gap-3 text-gray-500">
                <ShoppingCartIcon className="h-5 w-5 opacity-50" />
                <p className="text-sm">{t('scanner.emptyState')}</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <ScanContentPanel {...contentPanelProps} />
            </div>
          )}
        </div>
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-stone-100 to-stone-200">
        <PageHeader title={title} onBack={onBack} />
        <div className="flex h-[calc(100dvh-64px)] gap-6 p-6">
          {!hasActiveProduct && (
            <div className="w-[40%] flex flex-col gap-4">
              <div className="flex justify-center">
                <InputModeToggle mode={inputMode} onModeChange={setInputMode} />
              </div>
              <ScanInputSection inputMode={inputMode} onProductSelect={handleProductSelect} onScanSuccess={handleScanSuccess} manualCode={manualCode} setManualCode={setManualCode} onManualSubmit={handleManualSubmit} scannerId="add-desktop-reader" />
            </div>
          )}
          <div className={`${hasActiveProduct ? 'w-full' : 'w-[60%]'} bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden`}>
            {!hasActiveProduct ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <ShoppingCartIcon className="h-16 w-16 text-stone-300 mb-4" />
                <p className="text-stone-600 font-medium">{t('scanner.emptyState')}</p>
                <p className="text-xs text-stone-400 mt-2">{t('scanner.emptyStateHint', 'Scan a barcode or enter it manually to get started')}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <ScanContentPanel {...contentPanelProps} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ScanPage;
