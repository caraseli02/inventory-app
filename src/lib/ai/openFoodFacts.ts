import type { OpenFoodFactsResponse } from './types';

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v0/product';
const OFF_DEFAULT_TIMEOUT_MS = 8000;

interface FetchFromOFFOptions {
  timeoutMs?: number;
}

export const fetchFromOFF = async (
  barcode: string,
  options: FetchFromOFFOptions = {}
): Promise<OpenFoodFactsResponse | null> => {
  const timeoutMs = options.timeoutMs ?? OFF_DEFAULT_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${OFF_API_URL}/${barcode}.json`, {
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`OFF API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data as OpenFoodFactsResponse;
  } catch (error) {
    const isTimeout =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError';
    if (isTimeout) {
      console.warn('OpenFoodFacts request timed out', {
        barcode,
        timeoutMs,
      });
      return null;
    }

    console.warn('Failed to fetch from OpenFoodFacts', {
      barcode,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};
