import type { Attachment, FieldSet, Record as AirtableRecord } from 'airtable';
import base, { TABLES } from './airtable';
import type { Product, ProductFields, StockMovement } from '../types';
import { logger } from './logger';

// Custom error types for better error handling
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

const productsTable = base<ProductFields>(TABLES.PRODUCTS);

/**
 * Escapes single quotes in Airtable formula strings to prevent formula injection.
 * Airtable uses single quotes for string literals in filterByFormula.
 */
const escapeAirtableString = (value: string): string => {
  return value.replace(/'/g, "\\'");
};

/**
 * Validates that a string is non-empty and non-whitespace
 */
const validateNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required and cannot be empty`);
  }
  return value.trim();
};


const getCreatedTime = <TFields extends FieldSet>(record: AirtableRecord<TFields>): string =>
  (record._rawJson as { createdTime?: string } | undefined)?.createdTime ?? '';

export const mapAirtableProduct = (record: AirtableRecord<ProductFields>): Product => {
  // Validate that required fields exist
  if (!record.fields.Name || typeof record.fields.Name !== 'string') {
    logger.error('Invalid product record: missing or invalid Name', {
      recordId: record.id,
      fields: record.fields,
    });
    throw new ValidationError(`Invalid product record from Airtable: Name is required and must be a string`);
  }
  if (!record.fields.Barcode || typeof record.fields.Barcode !== 'string') {
    logger.error('Invalid product record: missing or invalid Barcode', {
      recordId: record.id,
      productName: record.fields.Name,
      fields: record.fields,
    });
    throw new ValidationError(`Invalid product record from Airtable: Barcode is required and must be a string`);
  }

  // Normalize Image field from Airtable's Attachment format to our format
  const normalizedImage = record.fields.Image && Array.isArray(record.fields.Image)
    ? (record.fields.Image as Attachment[]).map(att => ({ url: att.url ?? '' }))
    : undefined;

  return {
    id: record.id,
    createdTime: getCreatedTime(record),
    fields: {
      Name: record.fields.Name,
      Barcode: record.fields.Barcode,
      Category: record.fields.Category as string | undefined,
      Price: record.fields.Price as number | undefined,
      'Expiry Date': record.fields['Expiry Date'] as string | undefined,
      'Current Stock': record.fields['Current Stock'] as number | undefined,
      'Ideal Stock': record.fields['Ideal Stock'] as number | undefined,
      'Min Stock Level': record.fields['Min Stock Level'] as number | undefined,
      Supplier: record.fields.Supplier as string | undefined,
      Image: normalizedImage,
    },
  };
};

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
  // Validate required fields
  try {
    validateNonEmptyString(data.Name, 'Product name');
    validateNonEmptyString(data.Barcode, 'Barcode');
  } catch (validationError) {
    logger.warn('Product creation validation failed', {
      errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
    });
    throw validationError;
  }

  // Validate optional numeric fields
  if (data.Price != null && !Number.isFinite(data.Price)) {
    throw new ValidationError(`Price must be a finite number, got: ${data.Price}`);
  }

  logger.info('Creating new product', {
    name: data.Name,
    barcode: data.Barcode,
    hasCategory: !!data.Category,
    hasPrice: data.Price != null,
    hasImage: !!data.Image,
  });

  const fields: Record<string, unknown> = {
    Name: data.Name,
    Barcode: data.Barcode,
  };

  // Only add optional fields if they have values
  // This prevents Airtable from storing empty strings and allows fields to remain unset
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
        fields: fields as ProductFields,
      },
    ], { typecast: true });

    const record = records[0];

    logger.info('Product created successfully', { productId: record.id, name: record.fields.Name });
    return mapAirtableProduct(record);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create product', {
      name: data.Name,
      barcode: data.Barcode,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

// Add Stock Movement
export const addStockMovement = async (productId: string, quantity: number, type: 'IN' | 'OUT'): Promise<StockMovement> => {
  // Validate inputs
  if (!productId || !productId.trim()) {
    throw new ValidationError('Product ID is required and cannot be empty');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError(`Quantity must be a positive number, got: ${quantity}`);
  }
  if (type !== 'IN' && type !== 'OUT') {
    throw new ValidationError(`Type must be 'IN' or 'OUT', got: ${type}`);
  }

  logger.info('Adding stock movement', { productId, quantity, type });

  // Quantity is signed: negative for OUT, positive for IN
  // This allows Airtable's Sum rollup field ('Current Stock') to auto-calculate inventory correctly
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

    logger.info('Stock movement recorded', { movementId: records[0].id, finalQuantity, type });
    return {
      id: records[0].id,
      fields: records[0].fields as unknown as StockMovement['fields'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    type AirtableError = { response?: { status?: number }; code?: string };
    const airtableError = error as AirtableError | undefined;
    const errorCode = airtableError?.response?.status ?? airtableError?.code ?? 'UNKNOWN';

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
