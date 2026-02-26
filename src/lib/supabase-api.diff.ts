import type { Product } from '../types';
import type { ProductUpdate } from './database.types';
import type { CreateProductDTO } from './supabase-api.mappers';

export interface ProductDiffResult {
  dbUpdates: ProductUpdate;
  updatesForEvent: Partial<CreateProductDTO>;
  hasChanges: boolean;
}

/** Returns true when a new value is provided and differs from the current value. */
const fieldChanged = <T>(newValue: T | undefined, currentValue: T | undefined): newValue is NonNullable<T> =>
  newValue !== undefined && newValue !== currentValue;

/** Builds the diff between the current product and incoming update data. */
const buildBasicFieldsDiff = (
  current: Product,
  data: Partial<CreateProductDTO>,
  dbUpdates: ProductUpdate,
  updatesForEvent: Partial<CreateProductDTO>
): boolean => {
  let hasChanges = false;

  if (fieldChanged(data.Name, current.fields.Name)) {
    updatesForEvent.Name = data.Name;
    dbUpdates.name = data.Name;
    hasChanges = true;
  }
  if (fieldChanged(data.Barcode, current.fields.Barcode)) {
    updatesForEvent.Barcode = data.Barcode;
    dbUpdates.barcode = data.Barcode || null;
    hasChanges = true;
  }
  if (fieldChanged(data.Category, current.fields.Category)) {
    updatesForEvent.Category = data.Category;
    dbUpdates.category = data.Category || null;
    hasChanges = true;
  }
  if (fieldChanged(data['Expiry Date'], current.fields['Expiry Date'])) {
    updatesForEvent['Expiry Date'] = data['Expiry Date'];
    dbUpdates.expiry_date = data['Expiry Date'] || null;
    hasChanges = true;
  }
  if (fieldChanged(data['Min Stock Level'], current.fields['Min Stock Level'])) {
    updatesForEvent['Min Stock Level'] = data['Min Stock Level'];
    dbUpdates.min_stock_level = data['Min Stock Level'] ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data['Ideal Stock'], current.fields['Ideal Stock'])) {
    updatesForEvent['Ideal Stock'] = data['Ideal Stock'];
    dbUpdates.ideal_stock = data['Ideal Stock'] ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data.Supplier, current.fields.Supplier)) {
    updatesForEvent.Supplier = data.Supplier;
    dbUpdates.supplier = data.Supplier || null;
    hasChanges = true;
  }
  const currentImageUrl = current.fields.Image?.[0]?.url;
  if (fieldChanged(data.Image, currentImageUrl)) {
    updatesForEvent.Image = data.Image;
    dbUpdates.image_url = data.Image || null;
    hasChanges = true;
  }

  return hasChanges;
};

/** Builds the diff for price and markup fields. */
const buildPricingFieldsDiff = (
  current: Product,
  data: Partial<CreateProductDTO>,
  dbUpdates: ProductUpdate,
  updatesForEvent: Partial<CreateProductDTO>
): boolean => {
  let hasChanges = false;

  if (fieldChanged(data.Price, current.fields.Price)) {
    updatesForEvent.Price = data.Price;
    dbUpdates.price = data.Price ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data['Price 50%'], current.fields['Price 50%'])) {
    updatesForEvent['Price 50%'] = data['Price 50%'];
    dbUpdates.price_50 = data['Price 50%'] ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data['Price 70%'], current.fields['Price 70%'])) {
    updatesForEvent['Price 70%'] = data['Price 70%'];
    dbUpdates.price_70 = data['Price 70%'] ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data['Price 100%'], current.fields['Price 100%'])) {
    updatesForEvent['Price 100%'] = data['Price 100%'];
    dbUpdates.price_100 = data['Price 100%'] ?? null;
    hasChanges = true;
  }
  if (fieldChanged(data.Markup, current.fields.Markup)) {
    updatesForEvent.Markup = data.Markup;
    dbUpdates.markup = data.Markup ?? null;
    hasChanges = true;
  }

  return hasChanges;
};

/**
 * Computes the diff between the current product state and incoming update data.
 * Only fields that have actually changed are included in the result.
 */
export const buildProductDiff = (
  current: Product,
  data: Partial<CreateProductDTO>
): ProductDiffResult => {
  const dbUpdates: ProductUpdate = {};
  const updatesForEvent: Partial<CreateProductDTO> = {};

  const basicChanged = buildBasicFieldsDiff(current, data, dbUpdates, updatesForEvent);
  const pricingChanged = buildPricingFieldsDiff(current, data, dbUpdates, updatesForEvent);

  return { dbUpdates, updatesForEvent, hasChanges: basicChanged || pricingChanged };
};
