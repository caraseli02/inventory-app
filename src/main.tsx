import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AlertTriangle } from 'lucide-react'

const queryClient = new QueryClient()

// Validate required environment variables
const validateEnv = () => {
  const apiKey = import.meta.env.VITE_AIRTABLE_API_KEY;
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    const missing: string[] = [];
    if (!apiKey) missing.push('VITE_AIRTABLE_API_KEY');
    if (!baseId) missing.push('VITE_AIRTABLE_BASE_ID');

    return {
      isValid: false,
      missing
    };
  }

  return { isValid: true, missing: [] };
};

const EnvErrorUI = ({ missing }: { missing: string[] }) => (
  <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 p-6">
    <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-red-600" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-stone-900 text-center mb-3">
        Configuration Error
      </h1>
      <p className="text-stone-600 text-center mb-6">
        The following environment variables are missing. Please configure them in your deployment settings:
      </p>
      <ul className="mb-6 bg-stone-50 rounded-lg p-4 border border-stone-200">
        {missing.map((key) => (
          <li key={key} className="text-sm font-mono text-red-600 py-1">
            • {key}
          </li>
        ))}
      </ul>
      <div className="text-xs text-stone-500 text-center">
        For local development, copy .env.example to .env and fill in your credentials.
      </div>
    </div>
  </div>
);

const { isValid, missing } = validateEnv();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {!isValid ? (
      <EnvErrorUI missing={missing} />
    ) : (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    )}
  </StrictMode>,
)
