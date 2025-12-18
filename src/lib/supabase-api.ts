import { supabase } from './supabase';
import type { Product, StockMovement, MarkupPercentage } from '../types';
import type { ProductRow, ProductInsert, ProductUpdate, StockMovementRow } from './database.types';
import { logger } from './logger';
import { ValidationError } from './errors';

/**
 * Validates that a string is non-empty and non-whitespace
 */
const validateNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required and cannot be empty`);
  }
  return value.trim();
};

/**
 * Maps a Supabase product row to the application's Product type
 * This maintains compatibility with the existing app structure
 */
export const mapSupabaseProduct = (row: ProductRow, currentStockLevel?: number): Product => {
  return {
    id: row.id,
    createdTime: row.created_at,
    fields: {
      Name: row.name,
      Barcode: row.barcode ?? undefined,
      Category: row.category ?? undefined,
      Price: row.price ?? undefined,
      'Price 50%': row.price_50 ?? undefined,
      'Price 70%': row.price_70 ?? undefined,
      'Price 100%': row.price_100 ?? undefined,
      Markup: row.markup as MarkupPercentage | undefined,
      'Expiry Date': row.expiry_date ?? undefined,
      'Current Stock Level': currentStockLevel,
      'Ideal Stock': row.ideal_stock ?? undefined,
      'Min Stock Level': row.min_stock_level ?? undefined,
      Supplier: row.supplier ?? undefined,
      Image: row.image_url ? [{ url: row.image_url }] : undefined,
    },
  };
};

/**
 * Maps a Supabase stock movement row to the application's StockMovement type
 */
export const mapSupabaseStockMovement = (row: StockMovementRow): StockMovement => {
  return {
    id: row.id,
    fields: {
      Product: [row.product_id],
      Type: row.type,
      Quantity: row.quantity,
      Date: row.date,
    },
  };
};

/**
 * Calculates current stock level from stock movements
 * @throws Error if unable to fetch stock movements
 */
const calculateStockLevel = async (productId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('quantity')
    .eq('product_id', productId);

  if (error) {
    logger.error('Failed to calculate stock level', {
      productId,
      error: error.message,
      errorCode: error.code,
    });
    throw new Error(`Unable to calculate stock level: ${error.message}. Please try again or contact support.`);
  }

  return (data as StockMovementRow[]).reduce((sum, row) => sum + row.quantity, 0);
};

/**
 * Fetches a product from Supabase by its barcode
 *
 * @param barcode - Product barcode to lookup
 * @returns Product if found, null if not found
 * @throws Error if Supabase API call fails
 */
export const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
  logger.debug('Fetching product by barcode', { barcode });

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      logger.debug('Product not found', { barcode });
      return null;
    }

    const productData = data as ProductRow;
    const stockLevel = await calculateStockLevel(productData.id);

    logger.info('Product found', {
      barcode,
      productId: productData.id,
      currentStock: stockLevel,
    });
    return mapSupabaseProduct(productData, stockLevel);
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
  Barcode?: string;
  Category?: string;
  Price?: number;
  'Price 50%'?: number;
  'Price 70%'?: number;
  'Price 100%'?: number;
  Markup?: MarkupPercentage;
  'Expiry Date'?: string;
  'Min Stock Level'?: number;
  'Ideal Stock'?: number;
  Supplier?: string;
  Image?: string; // URL string
}

/**
 * Creates a new product in Supabase
 *
 * @param data - Product data to create
 * @returns Newly created Product
 * @throws {ValidationError} If required fields are invalid
 */
export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  // Validate required fields - only Name is required
  try {
    validateNonEmptyString(data.Name, 'Product name');
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
    barcode: data.Barcode || '(no barcode)',
    hasCategory: !!data.Category,
    hasPrice: data.Price != null,
    hasImage: !!data.Image,
  });

  const insertData: ProductInsert = {
    name: data.Name,
    barcode: data.Barcode || null,
    category: data.Category || null,
    price: data.Price ?? null,
    price_50: data['Price 50%'] ?? null,
    price_70: data['Price 70%'] ?? null,
    price_100: data['Price 100%'] ?? null,
    markup: data.Markup ?? null,
    expiry_date: data['Expiry Date'] || null,
    min_stock_level: data['Min Stock Level'] ?? null,
    ideal_stock: data['Ideal Stock'] ?? null,
    supplier: data.Supplier || null,
    image_url: data.Image || null,
  };

  try {
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    const productData = newProduct as ProductRow;
    logger.info('Product created successfully', { productId: productData.id, name: productData.name });
    return mapSupabaseProduct(productData, 0);
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
 * Records a stock movement (IN or OUT) for a product in Supabase
 *
 * @param productId - Product UUID
 * @param quantity - Quantity value (must be positive; negative values will throw ValidationError)
 * @param type - Movement type: 'IN' for receiving (stores positive), 'OUT' for removing (stores negative)
 * @returns Created StockMovement record
 * @throws {ValidationError} If quantity is not a positive finite number
 */
export const addStockMovement = async (
  productId: string,
  quantity: number,
  type: 'IN' | 'OUT'
): Promise<StockMovement> => {
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
  const finalQuantity = type === 'OUT' ? -quantity : quantity;
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        quantity: finalQuantity,
        type,
        date: dateStr,
      })
      .select()
      .single();

    if (error) throw error;

    const movementData = movement as StockMovementRow;
    logger.info('Stock movement recorded', { movementId: movementData.id, finalQuantity, type });
    return mapSupabaseStockMovement(movementData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to add stock movement', {
      productId,
      quantity: finalQuantity,
      type,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Get Stock Movements for a Product
 */
export const getStockMovements = async (productId: string): Promise<StockMovement[]> => {
  logger.debug('Fetching stock movements', { productId });

  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('date', { ascending: false })
      .limit(100);

    if (error) throw error;

    logger.info('Stock movements fetched', {
      productId,
      recordCount: data?.length ?? 0,
    });

    return (data as StockMovementRow[]).map(mapSupabaseStockMovement);
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
 * Fetches all products from Supabase
 *
 * @returns Array of all Product records
 */
export const getAllProducts = async (): Promise<Product[]> => {
  logger.debug('Fetching all products');

  try {
    // Fetch all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (productsError) throw productsError;

    const productData = products as ProductRow[];

    // Fetch all stock movements and calculate levels
    const { data: movements, error: movementsError } = await supabase
      .from('stock_movements')
      .select('product_id, quantity');

    if (movementsError) {
      logger.error('Failed to fetch stock movements for stock levels', {
        error: movementsError.message,
        errorCode: movementsError.code,
      });
      throw new Error(
        `Unable to load complete product data: ${movementsError.message}. ` +
        `Please try again or contact support if the issue persists.`
      );
    }

    // Calculate stock levels per product
    const stockLevels: Record<string, number> = {};
    for (const m of movements as { product_id: string; quantity: number }[]) {
      stockLevels[m.product_id] = (stockLevels[m.product_id] || 0) + m.quantity;
    }

    logger.info('All products fetched', {
      recordCount: productData.length,
    });

    return productData.map(row => mapSupabaseProduct(row, stockLevels[row.id] || 0));
  } catch (error) {
    logger.error('Failed to fetch all products', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

/**
 * Updates an existing product in Supabase
 *
 * @param productId - Product UUID
 * @param data - Partial product data to update
 * @returns Updated Product
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

  const updateData: ProductUpdate = {};

  // Only add fields that are provided
  if (data.Name !== undefined) updateData.name = data.Name;
  if (data.Barcode !== undefined) updateData.barcode = data.Barcode || null;
  if (data.Category !== undefined) updateData.category = data.Category || null;
  if (data.Price !== undefined) updateData.price = data.Price ?? null;
  if (data['Price 50%'] !== undefined) updateData.price_50 = data['Price 50%'] ?? null;
  if (data['Price 70%'] !== undefined) updateData.price_70 = data['Price 70%'] ?? null;
  if (data['Price 100%'] !== undefined) updateData.price_100 = data['Price 100%'] ?? null;
  if (data.Markup !== undefined) updateData.markup = data.Markup ?? null;
  if (data['Expiry Date'] !== undefined) updateData.expiry_date = data['Expiry Date'] || null;
  if (data['Min Stock Level'] !== undefined) updateData.min_stock_level = data['Min Stock Level'] ?? null;
  if (data['Ideal Stock'] !== undefined) updateData.ideal_stock = data['Ideal Stock'] ?? null;
  if (data.Supplier !== undefined) updateData.supplier = data.Supplier || null;
  if (data.Image !== undefined) updateData.image_url = data.Image || null;

  try {
    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    const productData = updatedProduct as ProductRow;
    const stockLevel = await calculateStockLevel(productId);

    logger.info('Product updated successfully', { productId, name: productData.name });
    return mapSupabaseProduct(productData, stockLevel);
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
 * Deletes a product from Supabase
 *
 * @param productId - Product UUID
 * @throws {ValidationError} If product not found or has stock movement history
 * @throws {Error} If deletion fails
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
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .select()
      .maybeSingle(); // Use maybeSingle to avoid .single() throwing on zero matches

    if (error) {
      // Check for common Supabase/PostgreSQL error codes
      if (error.code === '23503') {
        // Foreign key violation
        throw new ValidationError(
          'Cannot delete this product because it has stock movement history. ' +
          'Please archive the product instead of deleting it.'
        );
      }
      if (error.code === 'PGRST116') {
        // RLS policy violation
        throw new ValidationError('You do not have permission to delete this product.');
      }
      throw error;
    }

    if (!data) {
      throw new Error(`Product not found (ID: ${productId}). It may have already been deleted.`);
    }

    logger.info('Product deleted successfully', { productId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;
    logger.error('Failed to delete product', {
      productId,
      errorMessage,
      errorCode,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};
