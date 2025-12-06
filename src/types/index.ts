// ProductFields interface for type safety with Airtable schema
export interface ProductFields {
  Name: string;
  Barcode: string;
  Category: string;
  Price: number;
  'Current Stock': number;
  'Ideal Stock': number;
  'Min Stock Level': number;
  Supplier: string;
  'Expiry Date': string;
  Image?: Array<{ url: string }>;
}

export interface Product {
  id: string;
  // createdTime may not be present in all API responses, especially for new records
  createdTime?: string;
  fields: ProductFields;
}

export interface StockMovement {
  id: string;
  fields: {
    Product: string[];
    Type: 'IN' | 'OUT';
    Quantity: number;
    Date: string;
  };
}

// Branded type to ensure CartItem quantities are always positive integers
export type PositiveInteger = number & { readonly __brand: 'PositiveInteger' };

export const createPositiveInteger = (n: number): PositiveInteger => {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Expected positive integer >= 1, got ${n}`);
  }
  return n as PositiveInteger;
};

export interface CartItem {
  product: Product;
  quantity: PositiveInteger;
}
