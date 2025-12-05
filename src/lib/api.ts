import base, { TABLES } from './airtable';
import type { Product, StockMovement } from '../types';

// Read-only API (Lookup)
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  // Use filterByFormula to find the product with valid barcode
  const records = await base(TABLES.PRODUCTS)
    .select({
      filterByFormula: `{Barcode} = '${barcode}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) return null;

  return {
    id: records[0].id,
    fields: records[0].fields as unknown as Product['fields'],
  };
};

// Create Product
export interface CreateProductDTO {
  Name: string;
  Barcode: string;
  Category?: string;
  Price?: number;
  'Expiry Date'?: string;
}

export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  const records = await base(TABLES.PRODUCTS).create([
    {
      fields: {
        Name: data.Name,
        Barcode: data.Barcode,
        Category: data.Category,
        Price: data.Price,
        'Expiry Date': data['Expiry Date'],
      },
    },
  ], { typecast: true });

  return {
    id: records[0].id,
    fields: records[0].fields as unknown as Product['fields'],
  };
};

// Add Stock Movement
// Add Stock Movement
// Add Stock Movement
export const addStockMovement = async (productId: string, quantity: number, type: 'IN' | 'OUT'): Promise<StockMovement> => {
  // Original Plan: Quantity should be signed (+/-) for simple Sum Rollup
  const finalQuantity = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
  const dateStr = new Date().toISOString().split('T')[0];

  const records = await base(TABLES.STOCK_MOVEMENTS).create([
    {
      fields: {
        Product: [productId], // Link to Product
        Quantity: finalQuantity,
        Type: type,
        Date: dateStr,
      },
    },
  ], { typecast: true });

  return {
    id: records[0].id,
    fields: records[0].fields as unknown as StockMovement['fields'],
  };
};

// Get Stock Movements for a Product
export const getStockMovements = async (productId: string): Promise<StockMovement[]> => {
  const records = await base(TABLES.STOCK_MOVEMENTS)
    .select({
      filterByFormula: `{Product} = '${productId}'`,
      sort: [{ field: 'Date', direction: 'desc' }],
      maxRecords: 10,
    })
    .firstPage();

  return records.map(record => ({
    id: record.id,
    fields: record.fields as unknown as StockMovement['fields'],
  }));
};
