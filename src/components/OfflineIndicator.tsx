import { useState, useEffect } from 'react';

const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg shadow-sm flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
      <div className="text-sm font-medium">
        Offline mode
        <span className="block text-xs text-red-700">Limited functionality</span>
      </div>
    </div>
  );
};

export default OfflineIndicator;
