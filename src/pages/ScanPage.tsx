import { useState } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import CreateProductForm from '../components/product/CreateProductForm';
import ProductDetail from '../components/product/ProductDetail';

const ScanPage = () => {
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const handleScanSuccess = (code: string) => {
    setScannedCode(code);
    // Vibrate to provide feedback (if supported)
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  const handleReset = () => {
    setScannedCode(null);
  };

  // Determine status message
  const getStatusContent = () => {
    if (isLoading) return <span className="text-yellow-400">Searching Airtable...</span>;
    if (error) return <span className="text-red-500">Error connecting to DB</span>;
    if (product) return <span className="text-emerald-400">Found: {product.fields.Name}</span>;
    return <span className="text-blue-400">Product Not Found</span>;
  };

  // Determine current view mode
  const [showScanner, setShowScanner] = useState(true);
  const [manualCode, setManualCode] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
    }
  };

  const showCreateForm = !isLoading && !product && !error && scannedCode;
  const showDetail = !isLoading && product && scannedCode;

  if (showCreateForm && scannedCode) {
    return <CreateProductForm
      barcode={scannedCode}
      onSuccess={() => {/* Query invalidation handles the UI switch automatically */ }}
      onCancel={handleReset}
    />;
  }

  if (showDetail && product) {
    return <ProductDetail product={product} onScanNew={handleReset} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 flex flex-col items-center min-h-[500px]">
      <div className="w-full text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
          {scannedCode ? 'Processing Scan' : 'Scan Barcode'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {scannedCode ? getStatusContent() : 'Point camera at product barcode or enter manually'}
        </p>
      </div>

      {!scannedCode && (
        <div className="w-full max-w-md animate-in fade-in duration-500">
          {showScanner ? (
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-black aspect-square">
              <Scanner onScanSuccess={handleScanSuccess} />
              <button
                onClick={() => setShowScanner(false)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-full text-sm font-medium border border-slate-600/50"
              >
                Switch to Manual Input
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-8 shadow-xl border border-slate-700 flex flex-col items-center">
              <form onSubmit={handleManualSubmit} className="w-full space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2 font-medium">Enter Barcode Manually</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white text-lg tracking-widest focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={manualCode.length < 3}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Lookup Product
                </button>
              </form>
              <div className="mt-6">
                <button
                  onClick={() => setShowScanner(true)}
                  className="text-slate-400 hover:text-white text-sm flex items-center gap-2"
                >
                  ← Back to Camera
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {scannedCode && !showCreateForm && !showDetail && (
        <div className="w-full bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <div className="text-xs font-mono text-slate-500 tracking-widest uppercase mb-2">Detected Barcode</div>
            <div className="text-4xl font-mono text-white tracking-wider font-bold mb-4">{scannedCode}</div>

            {/* Loading Skeleton */}
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-4 w-32 bg-slate-700 rounded mb-2"></div>
              <div className="h-4 w-24 bg-slate-700 rounded"></div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="py-2 px-4 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
