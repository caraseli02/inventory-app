import type { Product, StockMovement, MarkupPercentage } from '../types';
import type { ProductRow, StockMovementRow } from './database.types';
import { supabase } from './supabase';
import { logger } from './logger';
import { ValidationError } from './errors';

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
  Image?: string;
}

export const validateNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${fieldName} is required and cannot be empty`);
  }
  return value.trim();
};

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

export const mapSupabaseStockMovement = (row: StockMovementRow): StockMovement => {
  return {
    id: row.id,
    fields: {
      Product: [row.product_id],
      Type: row.type,
      Quantity: row.quantity,
      Date: row.date,
      Note: row.note ?? undefined,
    },
  };
};

export const calculateStockLevel = async (productId: string): Promise<number> => {
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
