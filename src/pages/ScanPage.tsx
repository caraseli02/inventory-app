import { useState, type FormEvent } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';

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
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            ← Back to scanner
          </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full ${getModeBadgeStyles()}`}>
              <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </span>
            <button
              onClick={handleModeToggle}
              className="text-xs px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              Switch to {mode === 'add' ? 'Remove' : 'Add'}
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
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
          >
            ← Back to scanner
          </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full ${getModeBadgeStyles()}`}>
              <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </span>
            <button
              onClick={handleModeToggle}
              className="text-xs px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              Switch to {mode === 'add' ? 'Remove' : 'Add'}
            </button>
          </div>
        </div>
        <ProductDetail product={product} onScanNew={handleReset} mode={mode} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex flex-col items-center min-h-[520px]">
      <div className="w-full flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-2">
          {isTablet && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              ← Back to Home
            </button>
          )}
          {!isTablet && onCheckout && (
            <button
              onClick={onCheckout}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              🛒 Checkout
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <p className="text-sm font-medium text-gray-900">{mode === 'add' ? 'Add Mode' : 'Remove Mode'}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 ml-2">
            <span className="hidden sm:inline">Last:</span>
            <span className="rounded-full border border-gray-300 bg-white px-2 py-1 font-mono text-gray-700 text-xs">
              {scannedCode || 'Waiting'}
            </span>
          </div>
          <button
            onClick={handleModeToggle}
            className="ml-2 text-xs px-3 py-1 rounded-full border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-100 hover:border-gray-400"
          >
            Switch
          </button>
        </div>
      </div>

      <div className="w-full mb-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs tracking-widest text-gray-500 uppercase font-semibold">{scannedCode ? 'Processing' : 'Ready'}</p>
            <h2 className="text-xl font-light text-gray-900 mt-1">
              {scannedCode ? getStatusContent() : mode === 'add' ? 'Scan to add inventory' : 'Scan to remove inventory'}
            </h2>
            {!isTablet && onCheckout && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600">
                <span className="text-base">🛒</span>
                Need to checkout?
              </p>
            )}
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${getModeBadgeStyles()}`}>
            <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {mode === 'add' ? 'Receiving' : 'Removing'}
          </div>
        </div>
      </div>

      {!scannedCode && (
        <div className="w-full max-w-xl animate-in fade-in duration-500">
          {showScanner ? (
            <div className={`relative rounded-lg overflow-hidden border bg-black shadow-sm`}>
              <Scanner onScanSuccess={handleScanSuccess} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/30 to-transparent p-4 flex justify-center">
                <button
                  onClick={() => setShowScanner(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white/95 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-white"
                >
                  ✏️ Enter manually
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <form onSubmit={handleManualSubmit} className="w-full space-y-5">
                <div className="space-y-2">
                  <label className="block text-gray-900 text-sm font-medium">Barcode</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg text-gray-900 tracking-widest outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-900/20"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500">Enter a barcode to search for existing products.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={manualCode.trim().length < 3}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                  >
                    🔍 Lookup
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
                  >
                    ← Camera
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {scannedCode && !showCreateForm && !showDetail && (
        <div className="w-full rounded-lg border border-gray-200 bg-white p-8 animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <div className="text-xs text-gray-500 tracking-widest uppercase font-semibold mb-3">Scanned Barcode</div>
            <div className="text-4xl font-mono text-gray-900 tracking-[0.15em] font-light mb-6">{scannedCode}</div>

            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 w-40 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-gray-400"
            >
              Cancel and rescan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
