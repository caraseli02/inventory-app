import type { Attachment, FieldSet, Record as AirtableRecord } from 'airtable';
import base, { TABLES } from './airtable';
import type { Product, ProductFields, StockMovement } from '../types';
import { logger } from './logger';

type AirtableRecordWithCreated<TFields extends FieldSet> = AirtableRecord<TFields> & {
  _rawJson?: { createdTime?: string };
};

const getCreatedTime = <TFields extends FieldSet>(record: AirtableRecordWithCreated<TFields>): string =>
  record._rawJson?.createdTime ?? '';

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

  const record = records[0] as AirtableRecordWithCreated<ProductFields>;

  logger.info('Product found', { barcode, productId: record.id });
  return {
    id: record.id,
    createdTime: getCreatedTime(record),
    fields: record.fields as ProductFields,
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
  const fields: ProductFields = {
    Name: data.Name,
    Barcode: data.Barcode,
    Category: data.Category ?? '',
    Price: data.Price ?? 0,
    'Current Stock': 0,
    'Ideal Stock': 0,
    'Min Stock Level': 0,
    Supplier: '',
    'Expiry Date': data['Expiry Date'] ?? '',
  };

  // Airtable requires attachments as array of objects with url
  if (data.Image) {
    fields.Image = [{ url: data.Image } as Attachment];
  }

  try {
    const records = await base(TABLES.PRODUCTS).create([
      {
        fields: fields,
      },
    ], { typecast: true });

    const record = records[0] as AirtableRecordWithCreated<ProductFields>;

    logger.info('Product created successfully', { productId: record.id });
    return {
      id: record.id,
      createdTime: getCreatedTime(record),
      fields: record.fields as ProductFields,
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
