import { useState } from 'react';
import ScanPage from './pages/ScanPage';
import OfflineIndicator from './components/OfflineIndicator';

type ViewState = 'home' | 'add' | 'remove';

function App() {
  const [view, setView] = useState<ViewState>('home');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-20 font-inter selection:bg-blue-500/30">
      <OfflineIndicator />

      {/* Header */}
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Grocery Inventory
        </h1>
      </header>

      <main className="w-full px-4 flex-1 flex flex-col items-center">
        {view === 'home' ? (
          <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <p className="text-slate-400">Select an action to begin</p>
            </div>

            <button
              onClick={() => setView('add')}
              className="w-full aspect-[4/3] bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 rounded-2xl shadow-2xl border border-emerald-500/30 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform">
                +
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Add Items</h2>
                <p className="text-emerald-100/70 text-sm">Check-in new stock</p>
              </div>
            </button>

            <button
              onClick={() => setView('remove')}
              className="w-full aspect-[4/3] bg-gradient-to-br from-red-600 to-orange-700 hover:from-red-500 hover:to-orange-600 rounded-2xl shadow-2xl border border-red-500/30 flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-5xl mb-2 group-hover:scale-110 transition-transform">
                -
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Remove Items</h2>
                <p className="text-red-100/70 text-sm">Check-out used stock</p>
              </div>
            </button>
          </div>
        ) : (
          <ScanPage mode={view} onBack={() => setView('home')} />
        )}
      </main>
    </div>
  )
}

export default App
