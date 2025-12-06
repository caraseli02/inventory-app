import base, { TABLES } from './airtable';
import type { Product, ProductFields, StockMovement } from '../types';
import { logger } from './logger';

/**
 * Escapes single quotes in Airtable formula strings to prevent formula injection.
 * Airtable uses single quotes for string literals in filterByFormula.
 */
const escapeAirtableString = (value: string): string => {
  return value.replace(/'/g, "\\'");
};

const toProduct = (record: {
  id: string;
  fields: ProductFields;
  _rawJson?: { createdTime?: string };
  createdTime?: string;
}): Product => ({
  id: record.id,
  // createdTime may come from _rawJson or directly from the record
  createdTime: record._rawJson?.createdTime ?? record.createdTime,
  fields: record.fields,
});

// Read-only API (Lookup)
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  logger.debug('Fetching product by barcode', { barcode });

  try {
    // Escape barcode to prevent Airtable formula injection
    const escapedBarcode = escapeAirtableString(barcode);

    const records = await base(TABLES.PRODUCTS)
      .select({
        filterByFormula: `{Barcode} = '${escapedBarcode}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      logger.debug('Product not found', { barcode });
      return null;
    }

    const record = records[0];
    logger.info('Product found', { barcode, productId: record.id });

    return toProduct({
      id: record.id,
      createdTime: (record as { createdTime?: string }).createdTime,
      _rawJson: (record as { _rawJson?: { createdTime?: string } })._rawJson,
      fields: record.fields as unknown as ProductFields,
    });
  } catch (error) {
    logger.error('Failed to fetch product by barcode', {
      barcode,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
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
  const fields: Record<string, unknown> = {
    Name: data.Name,
    Barcode: data.Barcode,
    Category: data.Category ?? 'General',
    Price: data.Price ?? 0,
    'Expiry Date': data['Expiry Date'] ?? '',
    'Current Stock': 0,
    'Ideal Stock': 0,
    'Min Stock Level': 0,
    Supplier: '',
  };

  // Airtable requires attachments as array of objects with url
  if (data.Image) {
    fields.Image = [{ url: data.Image }];
  }

  try {
    const records = await base(TABLES.PRODUCTS).create([
      {
        fields: fields as any,
      },
    ], { typecast: true });

    logger.info('Product created successfully', { productId: records[0].id });
    const record = records[0];
    return toProduct({
      id: record.id,
      createdTime: (record as { createdTime?: string }).createdTime,
      _rawJson: (record as { _rawJson?: { createdTime?: string } })._rawJson,
      fields: record.fields as unknown as ProductFields,
    });
  } catch (error) {
    logger.error('Failed to create product', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      data,
    });
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

  try {
    // Escape productId to prevent formula injection
    const escapedProductId = escapeAirtableString(productId);

    const records = await base(TABLES.STOCK_MOVEMENTS)
      .select({
        filterByFormula: `{Product} = '${escapedProductId}'`,
        sort: [{ field: 'Date', direction: 'desc' }],
        maxRecords: 10,
      })
      .firstPage();

    return records.map(record => ({
      id: record.id,
      fields: record.fields as StockMovement['fields'],
    }));
  } catch (error) {
    logger.error('Failed to fetch stock movements', {
      productId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
