import { useState, type FormEvent } from 'react';
import Scanner from '../components/scanner/Scanner';
import { useProductLookup } from '../hooks/useProductLookup';
import { addStockMovement } from '../lib/api';
import type { CartItem } from '../types';
import { logger } from '../lib/logger';

interface CheckoutPageProps {
  onBack: () => void;
}

const CheckoutPage = ({ onBack }: CheckoutPageProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  // Hook for looking up products
  const { data: product, isLoading, error } = useProductLookup(scannedCode);

  // Sound effect helper
  const playSound = (type: 'success' | 'error') => {
    // Placeholder for sound logic. In a real PWA we'd use Audio()
    if (navigator.vibrate) {
      navigator.vibrate(type === 'success' ? 100 : [100, 50, 100]);
    }
  };

  // Logic to add to cart when product is found
  if (product && scannedCode) {
    // Check if already in cart
    const existingItemIndex = cart.findIndex(item => item.product.id === product.id);

    if (existingItemIndex >= 0) {
      // Increment quantity
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += 1;
      setCart(newCart);
      playSound('success');
    } else {
      // Add new item
      setCart([...cart, { product, quantity: 1 }]);
      playSound('success');
    }

    // Reset scan state immediately to allow rapid scanning
    setScannedCode(null);
  } else if (error && scannedCode) {
    playSound('error');
    // maybe show an ephemeral toast error?
    // For now we just reset so they can try again, but we might want to block briefly.
    // Let's reset after a small delay to prevent loops if holding code
    setTimeout(() => setScannedCode(null), 1000);
  }

  const handleScanSuccess = (code: string) => {
    if (!scannedCode && !isLoading) {
      setScannedCode(code);
    }
  };

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (manualCode.trim().length > 3) {
      handleScanSuccess(manualCode.trim());
      setManualCode('');
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.product.fields.Price || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const confirm = window.confirm(`Complete checkout for ${cart.length} items? Total: $${calculateTotal().toFixed(2)}`);
    if (!confirm) return;

    setIsCheckingOut(true);

    try {
      // Process all items sequentially to ensure order
      for (const item of cart) {
        await addStockMovement(item.product.id, item.quantity, 'OUT');
      }

      setCart([]);
      setCheckoutComplete(true);
      playSound('success');
    } catch (err) {
      logger.error('Checkout failed', { error: err });
      alert('Checkout failed partially. Please check connection.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (checkoutComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
          <span className="text-5xl">✓</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Checkout Complete!</h2>
        <p className="text-slate-400 mb-8">Stock has been updated.</p>
        <button
          onClick={() => { setCheckoutComplete(false); onBack(); }}
          className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-xl font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100dvh-120px)] lg:h-[calc(100vh-140px)]">
      {/* Left Column: Scanner */}
      <div className="w-full lg:w-1/3 flex flex-col gap-2 lg:gap-4 shrink-0">
        <div className="flex justify-between items-center px-1">
          <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
            ← Exit
          </button>
        </div>

        {/* Mobile: Scanner takes less space or is collapsible? For now, keep it visible but simpler */}
        <div className={`transition-all duration-300 ${!showScanner && 'opacity-50'}`}>
          {showScanner ? (
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-purple-500/30 bg-black aspect-[4/3] lg:aspect-square w-full mx-auto max-w-sm lg:max-w-none shrink-0">
              <Scanner onScanSuccess={handleScanSuccess} />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                  <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              )}
              <button
                onClick={() => setShowScanner(false)}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium border border-slate-600/50 whitespace-nowrap"
              >
                Tap to Type
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 aspect-[4/3] lg:aspect-square flex flex-col justify-center">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <label className="block text-slate-400 text-sm font-medium text-center">Enter Barcode</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-center tracking-widest focus:ring-2 focus:ring-purple-500 outline-none"
                  autoFocus
                />
                <button type="submit" disabled={manualCode.length < 3} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold">
                  Add Item
                </button>
              </form>
              <button onClick={() => setShowScanner(true)} className="mt-4 text-slate-400 hover:text-white text-sm text-center">Open Camera</button>
            </div>
          )}
        </div>

        <div className="hidden lg:block bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
          <p className="text-sm text-slate-400">Scan items to add them to your cart. Duplicates will increase quantity.</p>
        </div>
      </div>

      {/* Right Column: Cart List */}
      <div className="flex-1 bg-slate-800/80 backdrop-blur-sm lg:bg-slate-800 rounded-t-2xl lg:rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl relative">
        {/* Cart Header */}
        <div className="p-3 lg:p-4 border-b border-slate-700 bg-slate-800/95 sticky top-0 z-20">
          <h2 className="text-lg lg:text-xl font-bold text-white flex justify-between items-center">
            <span>Current Cart</span>
            <span className="text-xs lg:text-sm font-normal text-slate-400 bg-slate-700 px-2 py-1 rounded-md">{cart.length} items</span>
          </h2>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-24 lg:pb-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 min-h-[150px]">
              <div className="text-6xl opacity-20">🛒</div>
              <p>Your cart is empty</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={`${item.product.id}-${index}`} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                {/* Image Thumb */}
                <div className="w-12 h-12 bg-slate-800 rounded-md overflow-hidden shrink-0 border border-slate-700">
                  {item.product.fields.Image?.[0]?.url ? (
                    <img src={item.product.fields.Image[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate text-sm lg:text-base">{item.product.fields.Name}</h3>
                  <p className="text-slate-400 text-xs">${(item.product.fields.Price || 0).toFixed(2)}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 h-8">
                    <button onClick={() => updateQuantity(index, -1)} className="px-2 lg:px-3 h-full hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                      <span className="text-xl leading-none mb-1">-</span>
                    </button>
                    <span className="w-6 lg:w-8 text-center font-mono font-bold text-white text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="px-2 lg:px-3 h-full hover:bg-slate-700 text-slate-300 flex items-center justify-center">
                      <span className="text-xl leading-none mb-1">+</span>
                    </button>
                  </div>
                  <div className="font-mono font-bold text-emerald-400 w-14 lg:w-16 text-right text-sm lg:text-base">
                    ${((item.product.fields.Price || 0) * item.quantity).toFixed(2)}
                  </div>
                  <button onClick={() => removeFromCart(index)} className="p-2 text-slate-500 hover:text-red-400">
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Fixed at bottom of container on Mobile */}
        <div className="absolute lg:relative bottom-0 left-0 right-0 p-4 border-t border-slate-700 bg-slate-900 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] lg:shadow-none z-20">
          <div className="flex justify-between items-end mb-4">
            <span className="text-slate-400 text-sm lg:text-base">Total Amount</span>
            <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight">${calculateTotal().toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isCheckingOut}
            className="w-full py-3 lg:py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {isCheckingOut ? (
              <>
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                Processing...
              </>
            ) : (
              <>Complete Checkout ({cart.length})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
