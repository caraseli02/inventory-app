/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { logger } from '@/lib/logger';

// Keep behavior consistent with the previous App.tsx lazy-loading strategy:
// retry chunk loads a few times, then hard reload to recover from stale SW caches.
async function retryImport<T>(
  importFn: () => Promise<T>,
  retriesLeft = 3,
  intervalMs = 1000
): Promise<T> {
  try {
    return await importFn();
  } catch (error) {
    if (retriesLeft <= 0) {
      // If all retries failed, force reload to get fresh chunks
      // (common with PWA service worker + updated build).
      logger.error('Chunk load failed after retries. Reloading page...', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      window.location.reload();
      throw error;
    }

    logger.warn(`Chunk load failed. Retrying... (${retriesLeft} attempts left)`, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    return retryImport(importFn, retriesLeft - 1, intervalMs);
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retriesLeft = 3,
  intervalMs = 1000
): LazyExoticComponent<T> {
  return lazy(() => retryImport(importFn, retriesLeft, intervalMs));
}
