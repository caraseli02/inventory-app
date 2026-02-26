import { supabase } from './supabase';
import type { Product, StockMovement } from '../types';
import type { ProductRow, ProductInsert, StockMovementRow } from './database.types';
import { logger } from './logger';
import { ValidationError } from './errors';
import { eventStore } from './event-store/store';
import { ProductCreatedPayload, StockLevelChangedPayload, ProductUpdatedPayload } from './event-store/types';
import { checkLowStockPolicy } from './eda/policies/reorder-policy';
import {
  validateNonEmptyString,
  mapSupabaseProduct,
  mapSupabaseStockMovement,
  calculateStockLevel,
  type CreateProductDTO,
} from './supabase-api.mappers';
import { buildProductDiff } from './supabase-api.diff';

export { mapSupabaseProduct, mapSupabaseStockMovement } from './supabase-api.mappers';
export type { CreateProductDTO } from './supabase-api.mappers';

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

    logger.info('Product found', { barcode, productId: productData.id, currentStock: stockLevel });
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

const buildProductInsert = (data: CreateProductDTO, id: string): ProductInsert => ({
  id,
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
});

export const createProduct = async (data: CreateProductDTO): Promise<Product> => {
  try {
    validateNonEmptyString(data.Name, 'Product name');
  } catch (validationError) {
    logger.warn('Product creation validation failed', {
      errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
    });
    throw validationError;
  }

  if (data.Price != null && !Number.isFinite(data.Price)) {
    throw new ValidationError(`Price must be a finite number, got: ${data.Price}`);
  }

  const newProductId = crypto.randomUUID();
  logger.info('Creating new product (EDA)', { name: data.Name, newProductId, barcode: data.Barcode || '(no barcode)' });

  const insertData = buildProductInsert(data, newProductId);

  try {
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await eventStore.append({
      type: 'ProductCreated',
      aggregateType: 'Product',
      aggregateId: newProductId,
      payload: {
        productId: newProductId,
        name: data.Name,
        initialPriceCents: data.Price ? Math.round(data.Price * 100) : 0,
      } as ProductCreatedPayload,
    });

    const productData = newProduct as ProductRow;
    logger.info('Product created successfully', { productId: productData.id, name: productData.name });
    return mapSupabaseProduct(productData, 0);
  } catch (error) {
    logger.error('Failed to create product', {
      name: data.Name,
      barcode: data.Barcode,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

export const addStockMovement = async (
  productId: string,
  quantity: number,
  type: 'IN' | 'OUT',
  note?: string
): Promise<StockMovement> => {
  if (!productId || !productId.trim()) {
    throw new ValidationError('Product ID is required and cannot be empty');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError(`Quantity must be a positive number, got: ${quantity}`);
  }
  if (type !== 'IN' && type !== 'OUT') {
    throw new ValidationError(`Type must be 'IN' or 'OUT', got: ${type}`);
  }

  logger.info('Adding stock movement (EDA)', { productId, quantity, type });

  const finalQuantity = type === 'OUT' ? -quantity : quantity;
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const { data: movement, error } = await supabase
      .from('stock_movements')
      .insert({ product_id: productId, quantity: finalQuantity, type, date: dateStr, note: note ?? null })
      .select()
      .single();

    if (error) throw error;

    try {
      await eventStore.append({
        type: 'StockLevelChanged',
        aggregateType: 'Product',
        aggregateId: productId,
        payload: {
          productId,
          delta: finalQuantity,
          reason: 'ADJUSTMENT',
          source: 'manual_ui',
        } as StockLevelChangedPayload,
      });
    } catch (evtError) {
      logger.error('Failed to append StockLevelChanged event', { error: evtError });
    }

    const movementData = movement as StockMovementRow;
    logger.info('Stock movement recorded', { movementId: movementData.id, finalQuantity, type });

    try {
      await checkLowStockPolicy(productId);
    } catch (policyError) {
      logger.warn('Reorder policy check failed', {
        productId,
        error: policyError instanceof Error ? policyError.message : String(policyError),
      });
    }

    return mapSupabaseStockMovement(movementData);
  } catch (error) {
    logger.error('Failed to add stock movement', {
      productId,
      quantity: finalQuantity,
      type,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

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

    logger.info('Stock movements fetched', { productId, recordCount: data?.length ?? 0 });
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

export const getAllProducts = async (): Promise<Product[]> => {
  logger.debug('Fetching all products');

  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (productsError) throw productsError;

    const productData = products as ProductRow[];

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

    const stockLevels: Record<string, number> = {};
    for (const m of movements as { product_id: string; quantity: number }[]) {
      stockLevels[m.product_id] = (stockLevels[m.product_id] || 0) + m.quantity;
    }

    logger.info('All products fetched', { recordCount: productData.length });
    return productData.map(row => mapSupabaseProduct(row, stockLevels[row.id] || 0));
  } catch (error) {
    logger.error('Failed to fetch all products', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export const updateProduct = async (
  productId: string,
  data: Partial<CreateProductDTO>
): Promise<Product> => {
  try {
    validateNonEmptyString(productId, 'Product ID');
  } catch (validationError) {
    logger.warn('Product update validation failed', {
      errorMessage: validationError instanceof Error ? validationError.message : String(validationError),
    });
    throw validationError;
  }

  if (data.Name !== undefined) {
    validateNonEmptyString(data.Name, 'Product name');
  }
  if (data.Price !== undefined && data.Price !== null && !Number.isFinite(data.Price)) {
    throw new ValidationError(`Price must be a finite number, got: ${data.Price}`);
  }

  try {
    const { data: currentRow, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !currentRow) {
      throw new Error(`Product not found: ${productId}`);
    }

    const currentProduct = mapSupabaseProduct(currentRow as ProductRow);
    const { dbUpdates, updatesForEvent, hasChanges } = buildProductDiff(currentProduct, data);

    logger.info('Updating product (EDA) - Diff Result', {
      productId,
      receivedFields: Object.keys(data),
      changedFields: Object.keys(updatesForEvent),
      hasChanges,
    });

    if (!hasChanges) {
      logger.info('No changes detected, skipping update', { productId });
      return currentProduct;
    }

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    await eventStore.append({
      type: 'ProductUpdated',
      aggregateType: 'Product',
      aggregateId: productId,
      payload: { productId, updates: updatesForEvent, reason: 'manual_edit' } as ProductUpdatedPayload,
    });

    const productData = updatedProduct as ProductRow;
    const stockLevel = await calculateStockLevel(productId);

    logger.info('Product updated successfully', { productId, name: productData.name });
    return mapSupabaseProduct(productData, stockLevel);
  } catch (error) {
    logger.error('Failed to update product', {
      productId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

export const deleteProduct = async (productId: string): Promise<void> => {
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
      .maybeSingle();

    if (error) {
      if (error.code === '23503') {
        throw new ValidationError(
          'Cannot delete this product because it has stock movement history. ' +
          'Please archive the product instead of deleting it.'
        );
      }
      if (error.code === 'PGRST116') {
        throw new ValidationError('You do not have permission to delete this product.');
      }
      throw error;
    }

    if (!data) {
      throw new Error(`Product not found (ID: ${productId}). It may have already been deleted.`);
    }

    logger.info('Product deleted successfully', { productId });
  } catch (error) {
    const errorCode = (error as { code?: string })?.code;
    logger.error('Failed to delete product', {
      productId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};
