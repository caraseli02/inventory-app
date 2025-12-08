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

/**
 * Maps an Airtable product record to the application's Product type
 *
 * Performs validation and normalization:
 * - Validates required fields (Name, Barcode)
 * - Normalizes Image attachments to simple { url } format
 * - Extracts createdTime from raw JSON
 * - Throws ValidationError if required fields are missing or invalid
 *
 * @param record - Raw Airtable record from the Products table
 * @returns Normalized Product object
 * @throws {ValidationError} If Name or Barcode is missing/invalid
 */
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
      'Current Stock Level': record.fields['Current Stock Level'] as number | undefined,
      'Ideal Stock': record.fields['Ideal Stock'] as number | undefined,
      'Min Stock Level': record.fields['Min Stock Level'] as number | undefined,
      Supplier: record.fields.Supplier as string | undefined,
      Image: normalizedImage,
    },
  };
};

/**
 * Fetches a product from Airtable by its barcode
 *
 * Features:
 * - Uses filterByFormula for exact barcode matching
 * - Escapes barcode to prevent formula injection
 * - Returns null if product not found (not an error)
 * - Logs all operations for debugging
 *
 * @param barcode - Product barcode to lookup
 * @returns Product if found, null if not found
 * @throws Error if Airtable API call fails
 */
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

    logger.info('Product found', { barcode, productId: record.id, currentStock: record.fields['Current Stock Level'] });
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

export interface CreateProductDTO {
  Name: string;
  Barcode: string;
  Category?: string;
  Price?: number;
  'Expiry Date'?: string;
  Image?: string; // URL string
}

/**
 * Creates a new product in Airtable
 *
 * Validation:
 * - Name and Barcode are required (non-empty strings)
 * - Price must be a finite number if provided
 * - Image URL is converted to Airtable attachment format
 *
 * @param data - Product data to create
 * @returns Newly created Product with Airtable record ID
 * @throws {ValidationError} If required fields are invalid
 * @throws {NetworkError} If Airtable API request fails
 *
 * @example
 * const product = await createProduct({
 *   Name: 'Organic Bananas',
 *   Barcode: '123456789',
 *   Category: 'Produce',
 *   Price: 2.99,
 *   Image: 'https://example.com/banana.jpg'
 * });
 */
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

/**
 * Records a stock movement (IN or OUT) for a product in Airtable
 *
 * Automatic quantity signing:
 * - IN movements are stored as positive values
 * - OUT movements are stored as negative values
 * - This allows Airtable's Sum rollup to automatically calculate Current Stock Level
 *
 * Validation:
 * - Product ID must be non-empty
 * - Quantity must be positive (signing is handled internally)
 * - Type must be exactly 'IN' or 'OUT'
 *
 * @param productId - Airtable record ID of the product
 * @param quantity - Absolute quantity value (always positive)
 * @param type - Movement type: 'IN' for receiving, 'OUT' for removing
 * @returns Created StockMovement record
 * @throws {ValidationError} If inputs are invalid
 * @throws {NetworkError} If Airtable API request fails
 *
 * @example
 * // Add 10 items to stock
 * await addStockMovement(product.id, 10, 'IN');
 *
 * @example
 * // Remove 5 items from stock (stored as -5 internally)
 * await addStockMovement(product.id, 5, 'OUT');
 */
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
  // This allows Airtable's Sum rollup field ('Current Stock Level') to auto-calculate inventory correctly
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

    // Fetch records and filter in JavaScript
    // NOTE: Airtable's filterByFormula doesn't work reliably with linked record fields,
    // so we fetch all recent records and filter client-side
    const allRecords = await base(TABLES.STOCK_MOVEMENTS)
      .select({
        sort: [{ field: 'Date', direction: 'desc' }],
        maxRecords: 100, // Fetch more records to ensure we get all relevant movements
      })
      .firstPage();

    // Filter movements for this product
    // Return ALL movements for accurate stock calculation (not just 10 most recent)
    const records = allRecords
      .filter(record => {
        const productField = record.fields.Product as string[] | undefined;
        return productField?.includes(escapedProductId);
      });

    logger.info('Stock movements fetched', {
      productId,
      recordCount: records.length,
    });

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

/**
 * Fetches all products from Airtable
 *
 * Features:
 * - Retrieves all products sorted alphabetically by Name
 * - Maps products using mapAirtableProduct for validation
 * - Suitable for inventory list views
 *
 * @returns Array of all Product records
 * @throws Error if Airtable API call fails
 */
export const getAllProducts = async (): Promise<Product[]> => {
  logger.debug('Fetching all products');

  try {
    const records = await productsTable
      .select({
        sort: [{ field: 'Name', direction: 'asc' }],
      })
      .all();

    logger.info('All products fetched', {
      recordCount: records.length,
    });

    return records.map(mapAirtableProduct);
  } catch (error) {
    logger.error('Failed to fetch all products', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * Updates an existing product in Airtable
 *
 * Validation:
 * - Product ID is required (non-empty string)
 * - Only provided fields are updated (partial update)
 * - Price must be a finite number if provided
 * - Image URL is converted to Airtable attachment format
 *
 * @param productId - Airtable record ID of the product to update
 * @param data - Partial product data to update
 * @returns Updated Product with Airtable record ID
 * @throws {ValidationError} If product ID is invalid or fields are invalid
 * @throws {NetworkError} If Airtable API request fails
 *
 * @example
 * const updatedProduct = await updateProduct('recXXX', {
 *   Name: 'Organic Bananas',
 *   Price: 3.49,
 * });
 */
export const updateProduct = async (
  productId: string,
  data: Partial<CreateProductDTO>
): Promise<Product> => {
  // Validate product ID
  try {
    validateNonEmptyString(productId, 'Product ID');
  } catch (validationError) {
    logger.warn('Product update validation failed', {
      errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
    });
    throw validationError;
  }

  // Validate optional fields if provided
  if (data.Name !== undefined) {
    validateNonEmptyString(data.Name, 'Product name');
  }
  if (data.Price !== undefined && data.Price !== null && !Number.isFinite(data.Price)) {
    throw new ValidationError(`Price must be a finite number, got: ${data.Price}`);
  }

  logger.info('Updating product', {
    productId,
    hasName: data.Name !== undefined,
    hasCategory: data.Category !== undefined,
    hasPrice: data.Price !== undefined,
    hasImage: data.Image !== undefined,
  });

  const fields: Record<string, unknown> = {};

  // Only add fields that are provided
  if (data.Name !== undefined) fields.Name = data.Name;
  if (data.Category !== undefined) fields.Category = data.Category;
  if (data.Price !== undefined) fields.Price = data.Price;
  if (data['Expiry Date'] !== undefined) fields['Expiry Date'] = data['Expiry Date'];

  // Airtable requires attachments as array of objects with url
  if (data.Image !== undefined) {
    fields.Image = data.Image ? [{ url: data.Image } as Attachment] : [];
  }

  try {
    const record = await productsTable.update(productId, fields as Partial<ProductFields>, { typecast: true });

    logger.info('Product updated successfully', { productId, name: record.fields.Name });
    return mapAirtableProduct(record);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update product', {
      productId,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Deletes a product from Airtable
 *
 * Validation:
 * - Product ID is required (non-empty string)
 *
 * Note: Related stock movements may be orphaned or cascade-deleted
 * depending on Airtable base configuration. Consider checking for
 * existing stock movements before deletion.
 *
 * @param productId - Airtable record ID of the product to delete
 * @returns void
 * @throws {ValidationError} If product ID is invalid
 * @throws {NetworkError} If Airtable API request fails
 *
 * @example
 * await deleteProduct('recXXX');
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  // Validate product ID
  try {
    validateNonEmptyString(productId, 'Product ID');
  } catch (validationError) {
    logger.warn('Product deletion validation failed', {
      errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
    });
    throw validationError;
  }

  logger.info('Deleting product', { productId });

  try {
    await productsTable.destroy(productId);

    logger.info('Product deleted successfully', { productId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to delete product', {
      productId,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};
