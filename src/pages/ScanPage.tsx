import { useState, type FormEvent } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';
import {
  ArrowLeftIcon,
  CloseIcon,
  ShoppingCartIcon,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

type ScanMode = 'add' | 'remove';

type ScanPageProps = {
  mode: ScanMode;
  onBack: () => void;
  onModeChange: (mode: ScanMode) => void;
};

const ScanPage = ({ mode, onBack, onModeChange }: ScanPageProps) => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  const handleReset = () => {
    setScannedCode(null);
    setManualCode('');
  };

  const handleModeToggle = () => {
    onModeChange(mode === 'add' ? 'remove' : 'add');
  };

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
    }
  };

  const showCreateForm = !isLoading && !product && !error && scannedCode;
  const showDetail = !isLoading && product && scannedCode;

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden fixed inset-0 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <p className="text-slate-900 text-center text-base font-semibold">
            {showCreateForm ? 'New Product' : showDetail ? (mode === 'add' ? 'Add Product' : 'Remove Product') : 'Scan Product'}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Scanner Section */}
        <div className={`px-6 pt-4 space-y-4 ${scannedCode ? 'hidden' : ''}`}>
          {/* Scanner Frame */}
          <div className="relative mx-auto w-full max-w-lg aspect-square">
            {/* Corner Brackets */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-slate-700" />
              <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-slate-700" />
              <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-slate-700" />
              <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-slate-700" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-700 shadow-lg" />
            </div>

            {/* Scanner Area */}
            <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
              <Scanner onScanSuccess={handleScanSuccess} scannerId="add-mobile-reader" />
            </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-slate-700 rounded-full" />
                  <p className="text-slate-900 text-sm font-medium">Searching…</p>
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
                className="flex-1 h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10"
                placeholder="Enter barcode manually"
              />
              <Button
                type="submit"
                disabled={manualCode.length < 3}
                className="h-12 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium"
              >
                Add
              </Button>
            </form>
          </div>

          {/* Action Buttons */}
          <div className="mx-auto w-full max-w-lg space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 hover:bg-gray-50"
              onClick={handleModeToggle}
            >
              Switch to {mode === 'add' ? 'Remove' : 'Add'} Mode
            </Button>
          </div>
        </div>

        {/* Content Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white transition-all duration-300 ease-in-out overflow-hidden z-50 ${
            scannedCode ? 'h-[calc(100vh-73px)]' : 'h-auto rounded-t-3xl'
          }`}
        >
          {!scannedCode ? (
            /* Empty State - Collapsed */
            <div className="p-6 flex items-center justify-center">
              <div className="flex items-center gap-3 text-gray-500">
                <ShoppingCartIcon className="h-5 w-5 opacity-50" />
                <p className="text-sm">Point camera at barcode or enter manually</p>
              </div>
            </div>
          ) : (
            /* Content - Full screen without border/shadow */
            <div className="h-full overflow-y-auto">
              {showDetail && product && <ProductDetail product={product} onScanNew={handleReset} mode={mode} />}
              {showCreateForm && scannedCode && <CreateProductForm barcode={scannedCode} onSuccess={handleReset} onCancel={handleReset} />}
            </div>
          )}
        </div>
      </div>

      {/* Desktop/Tablet View */}
      <div className="hidden lg:block fixed inset-0 bg-gradient-to-br from-slate-100 to-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/50">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <p className="text-slate-900 text-center text-base font-semibold">
            {showCreateForm ? 'New Product' : showDetail ? (mode === 'add' ? 'Add Product' : 'Remove Product') : 'Scan Product'}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 text-slate-700 hover:text-slate-900 hover:bg-white/30"
          >
            <CloseIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Two-Column Layout */}
        <div className="flex h-[calc(100vh-64px)] gap-6 p-6">
          {/* Left Column: Scanner (45%) */}
          <div className="w-[45%] flex flex-col gap-6">
            <div className="relative mx-auto w-full max-w-lg aspect-square">
              {/* Corner Brackets */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-0 left-0 w-20 h-20 border-l-[3px] border-t-[3px] border-slate-700" />
                <div className="absolute top-0 right-0 w-20 h-20 border-r-[3px] border-t-[3px] border-slate-700" />
                <div className="absolute bottom-0 left-0 w-20 h-20 border-l-[3px] border-b-[3px] border-slate-700" />
                <div className="absolute bottom-0 right-0 w-20 h-20 border-r-[3px] border-b-[3px] border-slate-700" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-700 shadow-lg" />
              </div>

              {/* Scanner Area */}
              <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
                <Scanner onScanSuccess={handleScanSuccess} scannerId="add-desktop-reader" />
              </div>

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin h-10 w-10 border-4 border-slate-200 border-t-slate-700 rounded-full" />
                    <p className="text-slate-900 text-sm font-medium">Searching…</p>
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
                className="flex-1 h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10"
                placeholder="Enter barcode manually"
              />
              <Button
                type="submit"
                disabled={manualCode.length < 3}
                className="h-12 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium"
              >
                Add
              </Button>
            </form>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 text-base font-medium border-2 hover:bg-gray-50"
                onClick={handleModeToggle}
              >
                Switch to {mode === 'add' ? 'Remove' : 'Add'} Mode
              </Button>
            </div>
          </div>

          {/* Right Column: Panel (55%) */}
          <div className="w-[55%] bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden">
            {!scannedCode ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <ShoppingCartIcon className="h-16 w-16 opacity-20 mb-3 text-gray-400" />
                <p className="text-sm text-gray-500">Point camera at barcode or enter manually</p>
              </div>
            ) : (
              /* Content - Full height without footer */
              <div className="flex-1 overflow-y-auto">
                {showDetail && product && <ProductDetail product={product} onScanNew={handleReset} mode={mode} />}
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
