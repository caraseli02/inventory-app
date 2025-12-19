/**
 * Test Utilities
 *
 * Common utilities for testing React components and hooks.
 */

/* eslint-disable react-refresh/only-export-components */

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'

/**
 * Create a fresh QueryClient for testing
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests for faster failures
        retry: false,
        // Disable garbage collection timeout
        gcTime: Infinity,
        // Consider data always stale in tests
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Wrapper component that provides QueryClient
 */
interface TestWrapperProps {
  children: ReactNode
  queryClient?: QueryClient
}

export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  const client = queryClient ?? createTestQueryClient()
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

/**
 * Custom render function that includes QueryClientProvider
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options ?? {}
  const client = queryClient ?? createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  }
}

/**
 * Wait for queries to settle
 */
export async function waitForQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.refetchQueries()
}

/**
 * Flush all pending promises
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Create a deferred promise for testing async behavior
 */
export function createDeferredPromise<T>() {
  let resolve: (value: T) => void
  let reject: (error: Error) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}
