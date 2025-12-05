export interface Product {
  id: string; // Airtable Record ID
  fields: {
    Name: string;
    Barcode: string;
    Category?: string;
    Price?: number;
    'Expiry Date'?: string;
    Image?: Array<{ url: string }>;
    'Current Stock'?: number; // Rollup field
  };
}

export interface StockMovement {
  id: string;
  fields: {
    Product: string[]; // Link to Product (array of IDs)
    Quantity: number;
    Type: 'IN' | 'OUT';
    Date?: string;
    Note?: string;
  };
}
