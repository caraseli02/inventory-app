import type { Attachment, FieldSet, Record as AirtableRecord } from 'airtable';
import base, { TABLES } from './airtable';
import type { Product, ProductFields, StockMovement } from '../types';
import { logger } from './logger';

const productsTable = base<ProductFields>(TABLES.PRODUCTS);

/**
 * Escapes single quotes in Airtable formula strings to prevent formula injection.
 * Airtable uses single quotes for string literals in filterByFormula.
 */
const escapeAirtableString = (value: string): string => {
  return value.replace(/'/g, "\\'");
};

const getCreatedTime = <TFields extends FieldSet>(record: AirtableRecord<TFields>): string =>
  (record._rawJson as { createdTime?: string } | undefined)?.createdTime ?? '';

export const mapAirtableProduct = (record: AirtableRecord<ProductFields>): Product => ({
  id: record.id,
  createdTime: getCreatedTime(record),
  fields: record.fields,
});

// Read-only API (Lookup)
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  logger.debug('Fetching product by barcode', { barcode });

  try {
    // Escape barcode to prevent Airtable formula injection
    const escapedBarcode = escapeAirtableString(barcode);

    // Use filterByFormula to find the product with valid barcode
    const records = await productsTable
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
    return mapAirtableProduct(record);
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
  };

  if (data.Category) fields.Category = data.Category;
  if (data.Price != null) fields.Price = data.Price;
  if (data['Expiry Date']) fields['Expiry Date'] = data['Expiry Date'];

  // Airtable requires attachments as array of objects with url
  if (data.Image) {
    fields.Image = [{ url: data.Image } as Attachment];
  }

  try {
    const records = await productsTable.create([
      {
        fields: fields,
      },
    ], { typecast: true });

    const record = records[0];

    logger.info('Product created successfully', { productId: record.id });
    return mapAirtableProduct(record);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.response?.status || (error as any)?.code || 'UNKNOWN';

    logger.error('Failed to add stock movement', {
      productId,
      quantity: finalQuantity,
      type,
      dateStr,
      errorMessage,
      errorCode,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
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
      fields: record.fields as unknown as StockMovement['fields'],
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
