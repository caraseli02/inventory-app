import ScanPage from './pages/ScanPage';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center py-8">
      <header className="mb-8 text-center px-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Grocery Inventory
        </h1>
        <div className="h-1 w-20 bg-blue-500 mx-auto mt-2 rounded-full"></div>
      </header>

      <main className="w-full px-4 flex-1 flex flex-col items-center">
        <ScanPage />
      </main>
    </div>
  )
}

export default App
