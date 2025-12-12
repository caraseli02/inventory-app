import type { Attachment, FieldSet } from 'airtable';

export interface ProductFields extends FieldSet {
  Name: string;
  Barcode: string;
  Category?: string;         // Optional - may not be set at creation
  Price?: number;            // Optional - base price in EUR
  'Expiry Date'?: string;    // Optional - may not be set at creation
  'Current Stock Level'?: number;  // Rollup field (calculated by Airtable)
  'Ideal Stock'?: number;
  'Min Stock Level'?: number;
  Supplier?: string;
  Image?: readonly Attachment[];
  // Pricing tiers (from xlsx import)
  price50?: number;          // 50% markup price
  price70?: number;          // 70% markup price
  price100?: number;         // 100% markup price
}

export interface Product {
  id: string;
  createdTime: string;
  fields: {
    Name: string;
    Barcode: string;
    Category?: string;
    Price?: number;           // Base price in EUR
    'Expiry Date'?: string;
    'Current Stock Level'?: number;
    'Ideal Stock'?: number;
    'Min Stock Level'?: number;
    Supplier?: string;
    Image?: Array<{ url: string }>;  // Normalized from Airtable's readonly Attachment[]
    // Pricing tiers (from xlsx import)
    price50?: number;         // 50% markup price
    price70?: number;         // 70% markup price
    price100?: number;        // 100% markup price
  };
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

export type CartItemStatus = 'idle' | 'processing' | 'success' | 'failed';

export interface CartItem {
  product: Product;
  quantity: number;
  status?: CartItemStatus;
  statusMessage?: string;
}
