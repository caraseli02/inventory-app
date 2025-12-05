export interface AIProductSuggestion {
  name?: string;
  category?: string;
  imageUrl?: string;
  source: 'OpenFoodFacts' | 'Mock';
}

export interface OpenFoodFactsResponse {
  product?: {
    product_name?: string;
    categories_tags?: string[];
    image_url?: string;
  };
  status: number;
}
