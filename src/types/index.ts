import type { Attachment, FieldSet } from 'airtable';

/** Valid markup percentage values for store pricing */
export type MarkupPercentage = 50 | 70 | 100;

export interface ProductFields extends FieldSet {
  Name: string;
  Barcode?: string;          // Optional - can be added later via edit dialog
  Category?: string;         // Optional - may not be set at creation
  Price?: number;            // Optional - base price in EUR
  'Price 50%'?: number;      // 50% markup price
  'Price 70%'?: number;      // 70% markup price
  'Price 100%'?: number;     // 100% markup price
  Markup?: MarkupPercentage; // Active markup percentage (50, 70, or 100)
  'Expiry Date'?: string;    // Optional - may not be set at creation
  'Current Stock Level'?: number;  // Rollup field (calculated by Airtable)
  'Ideal Stock'?: number;
  'Min Stock Level'?: number;
  Supplier?: string;
  Image?: readonly Attachment[];
}

export interface Product {
  id: string;
  createdTime: string;
  fields: {
    Name: string;
    Barcode?: string;         // Optional - can be added later via edit dialog
    Category?: string;
    Price?: number;           // Base price in EUR
    'Price 50%'?: number;     // 50% markup price
    'Price 70%'?: number;     // 70% markup price
    'Price 100%'?: number;    // 100% markup price
    Markup?: MarkupPercentage; // Active markup percentage (50, 70, or 100)
    'Expiry Date'?: string;
    'Current Stock Level'?: number;
    'Ideal Stock'?: number;
    'Min Stock Level'?: number;
    Supplier?: string;
    Image?: Array<{ url: string }>;  // Normalized from Airtable's readonly Attachment[]
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
