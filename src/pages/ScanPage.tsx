import { useState, type FormEvent } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';
import {
  ArrowLeftIcon,
  PencilIcon,
  SearchIcon,
  ShoppingCartIcon,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type ScanMode = 'add' | 'remove';

type ScanPageProps = {
  mode: ScanMode;
  onBack: () => void;
  onModeChange: (mode: ScanMode) => void;
  isTablet: boolean;
  onCheckout?: () => void;
};

const ScanPage = ({ mode, onBack, onModeChange, isTablet, onCheckout }: ScanPageProps) => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [manualCode, setManualCode] = useState('');

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  const handleReset = () => {
    setScannedCode(null);
    setManualCode('');
    setShowScanner(true);
  };

  const getStatusContent = () => {
    if (isLoading) return <span className="text-amber-600">Searching...</span>;
    if (error) return <span className="text-red-600">Connection error</span>;
    if (product) return <span className="text-emerald-600">Found: {product.fields.Name}</span>;
    return <span className="text-gray-500">Not found</span>;
  };

  const handleModeToggle = () => {
    onModeChange(mode === 'add' ? 'remove' : 'add');
  };

  const getModeBadgeStyles = () => {
    if (mode === 'add') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  };

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
    }
  };

  const showCreateForm = !isLoading && !product && !error && scannedCode;
  const showDetail = !isLoading && product && scannedCode;

  if (showCreateForm && scannedCode) {
    return (
      <div className="w-full">
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border-2 ${getModeBadgeStyles()}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </div>
            <button
              onClick={handleModeToggle}
              className="text-sm px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-semibold transition hover:bg-gray-50 hover:border-gray-400"
            >
              Switch
            </button>
          </div>
        </div>
        <CreateProductForm
          barcode={scannedCode}
          onSuccess={() => { /* Query invalidation handles the UI switch automatically */ }}
          onCancel={handleReset}
        />
      </div>
    );
  }

  if (showDetail && product) {
    return (
      <div className="w-full">
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border-2 ${getModeBadgeStyles()}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </div>
            <button
              onClick={handleModeToggle}
              className="text-sm px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-semibold transition hover:bg-gray-50 hover:border-gray-400"
            >
              Switch
            </button>
          </div>
        </div>
        <ProductDetail product={product} onScanNew={handleReset} mode={mode} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col items-center min-h-[520px]">
      {/* Header Bar - Clean 3-zone layout */}
      <div className="w-full flex items-center justify-between mb-6 gap-4">
        {/* Left: Navigation */}
        <div className="flex-shrink-0">
          {isTablet && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
        )}
        {!isTablet && onCheckout && (
          <button
            onClick={onCheckout}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            Checkout
          </button>
        )}
      </div>

        {/* Center: Mode Indicator */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold text-sm ${
            mode === 'add'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <span className={`h-3 w-3 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
          </div>
        </div>

        {/* Right: Mode Toggle */}
        <div className="flex-shrink-0">
          <button
            onClick={handleModeToggle}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
            Switch {mode === 'add' ? 'to Remove' : 'to Add'}
          </button>
        </div>
      </div>

      {/* Status Display - Enhanced Prominent Banner */}
      <div className={`w-full mb-6 rounded-lg border-2 p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
        scannedCode
          ? mode === 'add'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex-1">
          <p className="text-xs tracking-widest text-gray-500 uppercase font-bold mb-1">
            {scannedCode ? 'PROCESSING SCAN' : 'READY TO SCAN'}
          </p>
          <h2 className="text-lg font-semibold text-gray-900">
            {scannedCode ? getStatusContent() : mode === 'add' ? 'Scan to add inventory' : 'Scan to remove inventory'}
          </h2>
          {scannedCode && (
            <p className="text-xs text-gray-600 mt-2 font-mono">Code: {scannedCode}</p>
          )}
        </div>

        {/* Status Badge - Right aligned, more prominent */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-lg px-4 py-2 border-2 font-semibold text-sm ${
            mode === 'add'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-amber-50 border-amber-300 text-amber-700'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {mode === 'add' ? 'Receiving' : 'Removing'}
          </div>
          {!isTablet && onCheckout && !scannedCode && (
            <button
              onClick={onCheckout}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition"
              title="Quick checkout"
            >
              <ShoppingCartIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!scannedCode && (
        <div className="w-full max-w-2xl animate-in fade-in duration-500">
          {showScanner ? (
            <div className={`relative rounded-2xl overflow-hidden border-2 border-gray-200 bg-black shadow-md aspect-[4/3]`}>
              <Scanner onScanSuccess={handleScanSuccess} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent p-6 flex justify-center">
                <button
                  onClick={() => setShowScanner(false)}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white/95 px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white shadow-sm"
                >
                  <PencilIcon className="h-4 w-4" />
                  Enter manually
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-8">
              <form onSubmit={handleManualSubmit} className="w-full space-y-6">
                <div className="space-y-3">
                  <label className="block text-gray-900 text-sm font-semibold">Enter Barcode</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 012345678901"
                    className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-4 text-lg text-gray-900 tracking-widest font-medium outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10"
                    autoFocus
                  />
                  <p className="text-xs text-gray-600">Search for existing products or create new ones.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={manualCode.trim().length < 3}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg'}`}
                  >
                    <SearchIcon className="h-4 w-4" />
                    Lookup
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-5 py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Camera
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {scannedCode && !showCreateForm && !showDetail && (
        <div className="w-full rounded-2xl border-2 border-gray-200 bg-white p-10 animate-in zoom-in-95 duration-300 shadow-sm">
          <div className="text-center mb-10">
            <div className="text-xs text-gray-500 tracking-widest uppercase font-bold mb-4">Barcode Detected</div>
            <div className="text-5xl font-mono text-gray-900 tracking-[0.15em] font-semibold mb-8">{scannedCode}</div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-48 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gray-400 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
              <p className="text-xs text-gray-500">Looking up product...</p>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              Cancel & Rescan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
