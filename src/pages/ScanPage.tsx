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
  };

  const getStatusContent = () => {
    if (isLoading) return <span className="text-yellow-400">Searching Airtable...</span>;
    if (error) return <span className="text-red-500">Error connecting to DB</span>;
    if (product) return <span className="text-emerald-400">Found: {product.fields.Name}</span>;
    return <span className="text-blue-400">Product Not Found</span>;
  };

  const handleModeToggle = () => {
    onModeChange(mode === 'add' ? 'remove' : 'add');
  };

  const getModeBadgeStyles = () => {
    if (mode === 'add') {
      return 'bg-emerald-500/10 text-emerald-100 border border-emerald-600/50 shadow-emerald-500/10';
    }

    return 'bg-amber-500/10 text-amber-100 border border-amber-600/50 shadow-amber-500/10';
  };

  const handleManualSubmit = (e: FormEvent) => {
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
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 shadow-sm transition hover:border-slate-700 hover:text-white"
          >
            ← Back to scanner
          </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${getModeBadgeStyles()}`}>
              <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </span>
            <button
              onClick={handleModeToggle}
              className="text-xs px-3 py-1 rounded-full border border-slate-800 bg-slate-950 text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
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
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 shadow-sm transition hover:border-slate-700 hover:text-white"
          >
            ← Back to scanner
          </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${getModeBadgeStyles()}`}>
              <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {mode === 'add' ? 'Add Mode' : 'Remove Mode'}
            </span>
            <button
              onClick={handleModeToggle}
              className="text-xs px-3 py-1 rounded-full border border-slate-800 bg-slate-950 text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
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
      <div className="w-full flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2">
          {isTablet && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 shadow-sm transition hover:border-slate-700 hover:text-white"
            >
              ← Back to Home
            </button>
          )}
          {!isTablet && onCheckout && (
            <button
              onClick={onCheckout}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-100 shadow-sm transition hover:border-indigo-400/60 hover:text-white"
            >
              🛒 Quick checkout
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 shadow-sm w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${mode === 'add' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <p className="text-sm font-semibold text-slate-100">{mode === 'add' ? 'Add Mode' : 'Remove Mode'}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden sm:inline">Last scan</span>
            <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-1 font-medium text-slate-200">
              {scannedCode || 'Waiting'}
            </span>
          </div>
          <button
            onClick={handleModeToggle}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
          >
            Switch to {mode === 'add' ? 'Remove' : 'Add'}
          </button>
        </div>
      </div>

      <div className="w-full mb-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-400">{scannedCode ? 'Processing scan' : 'Ready to scan'}</p>
            <h2 className="text-xl font-semibold text-slate-100">
              {scannedCode ? getStatusContent() : mode === 'add' ? 'Scan to add inventory' : 'Scan to remove inventory'}
            </h2>
            {!isTablet && onCheckout && (
              <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-100 shadow-inner">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                Need payment? Jump to mobile checkout.
              </p>
            )}
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-inner ${getModeBadgeStyles()}`}>
            <span className={`h-2 w-2 rounded-full ${mode === 'add' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {mode === 'add' ? 'Add items' : 'Remove items'}
          </div>
        </div>
      </div>

      {!scannedCode && (
        <div className="w-full max-w-xl animate-in fade-in duration-500">
          {showScanner ? (
            <div className={`relative rounded-2xl overflow-hidden border bg-slate-950 shadow-lg ${mode === 'add' ? 'border-emerald-900/50' : 'border-amber-900/50'}`}>
              <Scanner onScanSuccess={handleScanSuccess} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 flex justify-center">
                <button
                  onClick={() => setShowScanner(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/90 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm transition hover:border-slate-700 hover:bg-slate-900"
                >
                  ✏️ Enter manually
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
              <form onSubmit={handleManualSubmit} className="w-full space-y-4">
                <div className="space-y-2">
                  <label className="block text-slate-300 text-sm font-medium">Enter barcode manually</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg text-white tracking-widest shadow-inner outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500">We’ll try to match an existing product before offering to create one.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={manualCode.trim().length < 3}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}`}
                  >
                    🔍 Lookup product
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
                  >
                    ← Back to camera
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {scannedCode && !showCreateForm && !showDetail && (
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm animate-in zoom-in-95 duration-300">
          <div className="text-center mb-6">
            <div className="text-xs font-mono text-slate-500 tracking-[0.2em] uppercase mb-2">Detected Barcode</div>
            <div className="text-3xl font-mono text-white tracking-[0.3em] font-bold mb-4">{scannedCode}</div>

            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 w-32 bg-slate-800 rounded mb-2"></div>
              <div className="h-4 w-24 bg-slate-800 rounded"></div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-900"
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
