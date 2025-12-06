import base, { TABLES } from './airtable';
import type { Product, StockMovement } from '../types';
import { logger } from './logger';

// Read-only API (Lookup)
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  logger.debug('Fetching product by barcode', { barcode });
  // Use filterByFormula to find the product with valid barcode
  const records = await base(TABLES.PRODUCTS)
    .select({
      filterByFormula: `{Barcode} = '${barcode}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    logger.debug('Product not found', { barcode });
    return null;
  }

  logger.info('Product found', { barcode, productId: records[0].id });
  return {
    id: records[0].id,
    createdTime: records[0]._rawJson.createdTime,
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
  Image?: string; // URL string
}

export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  logger.info('Creating new product', { data });
  const fields: any = {
    Name: data.Name,
    Barcode: data.Barcode,
    Category: data.Category,
    Price: data.Price,
    'Expiry Date': data['Expiry Date'],
  };

  // Airtable requires attachments as array of objects with url
  if (data.Image) {
    fields.Image = [{ url: data.Image }];
  }

  try {
    const records = await base(TABLES.PRODUCTS).create([
      {
        fields: fields,
      },
    ], { typecast: true });

    logger.info('Product created successfully', { productId: records[0].id });
    return {
      id: records[0].id,
      createdTime: records[0]._rawJson.createdTime,
      fields: records[0].fields as unknown as Product['fields'],
    };
  } catch (error) {
    logger.error('Failed to create product', { error, data });
    throw error;
  }
};

// Add Stock Movement
export const addStockMovement = async (productId: string, quantity: number, type: 'IN' | 'OUT'): Promise<StockMovement> => {
  logger.info('Adding stock movement', { productId, quantity, type });
  // Original Plan: Quantity should be signed (+/-) for simple Sum Rollup
  const finalQuantity = type === 'OUT' ? -Math.abs(quantity) : Math.abs(quantity);
  const dateStr = new Date().toISOString().split('T')[0];

  try {
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

    logger.info('Stock movement recorded', { movementId: records[0].id });
    return {
      id: records[0].id,
      fields: records[0].fields as unknown as StockMovement['fields'],
    };
  } catch (error) {
    logger.error('Failed to add stock movement', { error, productId });
    throw error;
  }
};

// Get Stock Movements for a Product
export const getStockMovements = async (productId: string): Promise<StockMovement[]> => {
  logger.debug('Fetching stock movements', { productId });
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
