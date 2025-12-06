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

export interface CartItem {
  product: Product;
  quantity: number;
}
