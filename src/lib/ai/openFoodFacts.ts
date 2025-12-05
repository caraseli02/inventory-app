import type { OpenFoodFactsResponse } from './types';

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v0/product';

export const fetchFromOFF = async (barcode: string): Promise<OpenFoodFactsResponse | null> => {
  try {
    const response = await fetch(`${OFF_API_URL}/${barcode}.json`);
    if (!response.ok) {
      throw new Error(`OFF API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data as OpenFoodFactsResponse;
  } catch (error) {
    console.warn('Failed to fetch from OpenFoodFacts:', error);
    return null;
  }
};
