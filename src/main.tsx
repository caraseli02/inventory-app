import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import './index.css'
import './i18n' // Initialize i18n
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logger } from './lib/logger'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 10 minutes before garbage collection
      gcTime: 1000 * 60 * 10,
      // Consider data fresh for 5 minutes (matches useInventoryList staleTime)
      staleTime: 1000 * 60 * 5,
      // Retry failed requests up to 2 times
      retry: 2,
      // Don't refetch on window focus by default (individual hooks can override)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect by default
      refetchOnReconnect: false,
    },
  },
  // Global error handler for all queries and mutations
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error('React Query error', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        queryKey: query.queryKey,
        queryHash: query.queryHash,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logger.error('React Query mutation error', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        mutationKey: mutation.options.mutationKey,
      });
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
