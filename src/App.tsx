import ScanPage from './pages/ScanPage';
import OfflineIndicator from './components/OfflineIndicator';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-20 font-inter selection:bg-blue-500/30">
      <OfflineIndicator />

      {/* Header */}
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Grocery Inventory
        </h1>
      </header>

      <OfflineIndicator />

      <main className="w-full px-4 flex-1 flex flex-col items-center">
        <ScanPage />
      </main>
    </div>
  )
}

export default App
