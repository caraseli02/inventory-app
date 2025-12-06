import type { Attachment, FieldSet } from 'airtable';

export interface ProductFields extends FieldSet {
  Name: string;
  Barcode: string;
  Category: string;
  Price: number;
  'Expiry Date': string;
  'Current Stock'?: number;  // Rollup field (calculated by Airtable)
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
    Barcode: string;
    Category?: string;
    Price?: number;
    'Current Stock'?: number;
    'Ideal Stock'?: number;
    'Min Stock Level'?: number;
    Supplier?: string;
    'Expiry Date'?: string;
    Image?: Array<{ url: string }>;
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
