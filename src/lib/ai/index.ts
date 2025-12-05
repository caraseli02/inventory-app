import { fetchFromOFF } from './openFoodFacts';
import type { AIProductSuggestion } from './types';

// Map generous broad categories to our specific internal ones
const CATEGORY_MAPPING: Record<string, string> = {
  'en:beverages': 'Beverages',
  'en:snacks': 'Snacks',
  'en:plant-based-foods-and-beverages': 'Produce',
  'en:produce': 'Produce',
  'en:meats': 'Meat',
  'en:dairies': 'Dairy',
  'en:household-supplies': 'Household',
};

const mapCategory = (tags: string[] = []): string => {
  // Try to find a match in our mapping
  for (const tag of tags) {
    if (CATEGORY_MAPPING[tag]) {
      return CATEGORY_MAPPING[tag];
    }
    // Fallback partial match
    if (tag.includes('snack')) return 'Snacks';
    if (tag.includes('drink') || tag.includes('beverage')) return 'Beverages';
    if (tag.includes('meat')) return 'Meat';
    if (tag.includes('dairy') || tag.includes('cheese')) return 'Dairy';
    if (tag.includes('vegetable') || tag.includes('fruit')) return 'Produce';
  }
  return 'General';
};

export const suggestProductDetails = async (barcode: string): Promise<AIProductSuggestion | null> => {
  const offData = await fetchFromOFF(barcode);

  if (offData && offData.status === 1 && offData.product) {
    return {
      name: offData.product.product_name,
      category: mapCategory(offData.product.categories_tags),
      imageUrl: offData.product.image_url,
      source: 'OpenFoodFacts',
    };
  }

  return null;
};
