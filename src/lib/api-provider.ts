/**
 * API Provider - Switches between Airtable and Supabase based on configuration
 *
 * This module provides a unified API interface that can use either:
 * - Supabase (recommended, new)
 * - Airtable (legacy, being phased out)
 *
 * The backend is determined by which environment variables are set:
 * - If VITE_SUPABASE_URL is set → Use Supabase
 * - If VITE_AIRTABLE_API_KEY is set → Use Airtable
 * - If both are set → Supabase takes priority
 */

import type { Product, StockMovement } from '../types';

// Determine which backend to use
const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;
const useAirtable = !!import.meta.env.VITE_AIRTABLE_API_KEY;

// Log which backend is being used
if (useSupabase) {
  console.log('📦 Using Supabase as database backend');
} else if (useAirtable) {
  console.log('📦 Using Airtable as database backend (legacy)');
} else {
  console.warn('⚠️ No database backend configured. Please set VITE_SUPABASE_URL or VITE_AIRTABLE_API_KEY');
}

// Export the backend type for conditional logic if needed
export const BACKEND_TYPE: 'supabase' | 'airtable' | 'none' = useSupabase
  ? 'supabase'
  : useAirtable
    ? 'airtable'
    : 'none';

// Dynamic imports based on backend
// This is a type that both API modules export
export interface CreateProductDTO {
  Name: string;
  Barcode?: string;
  Category?: string;
  Price?: number;
  'Price 50%'?: number;
  'Price 70%'?: number;
  'Price 100%'?: number;
  Markup?: 50 | 70 | 100;
  'Expiry Date'?: string;
  'Min Stock Level'?: number;
  'Ideal Stock'?: number;
  Supplier?: string;
  Image?: string;
}

// API function types
type GetProductByBarcode = (barcode: string) => Promise<Product | null>;
type CreateProduct = (data: CreateProductDTO) => Promise<Product>;
type UpdateProduct = (productId: string, data: Partial<CreateProductDTO>) => Promise<Product>;
type DeleteProduct = (productId: string) => Promise<void>;
type GetAllProducts = () => Promise<Product[]>;
type AddStockMovement = (
  productId: string,
  quantity: number,
  type: 'IN' | 'OUT',
  note?: string
) => Promise<StockMovement>;
type GetStockMovements = (productId: string) => Promise<StockMovement[]>;

// Lazy-loaded API functions
let _getProductByBarcode: GetProductByBarcode;
let _createProduct: CreateProduct;
let _updateProduct: UpdateProduct;
let _deleteProduct: DeleteProduct;
let _getAllProducts: GetAllProducts;
let _addStockMovement: AddStockMovement;
let _getStockMovements: GetStockMovements;

// Track initialization error for better error messages
let initError: Error | null = null;

// Required exports that every backend module must provide
const REQUIRED_EXPORTS = [
  'getProductByBarcode',
  'createProduct',
  'updateProduct',
  'deleteProduct',
  'getAllProducts',
  'addStockMovement',
  'getStockMovements',
] as const;

type BackendModule = Record<string, unknown>;

function validateExports(api: BackendModule, source: string): void {
  for (const fn of REQUIRED_EXPORTS) {
    if (!api[fn]) throw new Error(`Missing ${fn} export from ${source}`);
  }
}

async function loadSupabaseBackend(): Promise<void> {
  const api = await import('./supabase-api') as BackendModule;
  validateExports(api, 'supabase-api');
  _getProductByBarcode = api.getProductByBarcode as GetProductByBarcode;
  _createProduct = api.createProduct as CreateProduct;
  _updateProduct = api.updateProduct as UpdateProduct;
  _deleteProduct = api.deleteProduct as DeleteProduct;
  _getAllProducts = api.getAllProducts as GetAllProducts;
  _addStockMovement = api.addStockMovement as AddStockMovement;
  _getStockMovements = api.getStockMovements as GetStockMovements;
}

async function loadAirtableBackend(): Promise<void> {
  const api = await import('./api') as BackendModule;
  validateExports(api, 'api');
  _getProductByBarcode = api.getProductByBarcode as GetProductByBarcode;
  _createProduct = api.createProduct as CreateProduct;
  _updateProduct = api.updateProduct as UpdateProduct;
  _deleteProduct = api.deleteProduct as DeleteProduct;
  _getAllProducts = api.getAllProducts as GetAllProducts;
  _addStockMovement = api.addStockMovement as AddStockMovement;
  _getStockMovements = api.getStockMovements as GetStockMovements;
}

// Initialize the API module
const initApi = async () => {
  try {
    if (useSupabase) {
      await loadSupabaseBackend();
    } else {
      await loadAirtableBackend();
    }
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    console.error('Failed to initialize API:', initError.message);
    throw initError;
  }
};

// Initialize on module load
const apiReady = initApi();

// Export wrapper functions that wait for initialization
/**
 * Fetches a product by its barcode
 * @param barcode - Product barcode to lookup
 * @returns Product if found, null if not found
 * @throws {Error} If API initialization fails or backend query fails
 */
export const getProductByBarcode: GetProductByBarcode = async (barcode) => {
  await apiReady; // Let initialization errors propagate naturally
  if (!_getProductByBarcode) {
    throw new Error('getProductByBarcode function not available after initialization. This indicates a critical system error.');
  }
  return _getProductByBarcode(barcode);
};

/**
 * Creates a new product
 * @param data - Product data to create
 * @returns Created product record
 * @throws {Error} If API initialization fails or creation fails
 */
export const createProduct: CreateProduct = async (data) => {
  await apiReady;
  if (!_createProduct) {
    throw new Error('createProduct function not available after initialization. This indicates a critical system error.');
  }
  return _createProduct(data);
};

/**
 * Updates an existing product
 * @param productId - Product ID to update
 * @param data - Partial product data to update
 * @returns Updated product record
 * @throws {Error} If API initialization fails or update fails
 */
export const updateProduct: UpdateProduct = async (productId, data) => {
  await apiReady;
  if (!_updateProduct) {
    throw new Error('updateProduct function not available after initialization. This indicates a critical system error.');
  }
  return _updateProduct(productId, data);
};

/**
 * Deletes a product
 * @param productId - Product ID to delete
 * @throws {Error} If API initialization fails or deletion fails
 */
export const deleteProduct: DeleteProduct = async (productId) => {
  await apiReady;
  if (!_deleteProduct) {
    throw new Error('deleteProduct function not available after initialization. This indicates a critical system error.');
  }
  return _deleteProduct(productId);
};

/**
 * Fetches all products
 * @returns Array of all products with current stock levels
 * @throws {Error} If API initialization fails or fetch fails
 */
export const getAllProducts: GetAllProducts = async () => {
  await apiReady;
  if (!_getAllProducts) {
    throw new Error('getAllProducts function not available after initialization. This indicates a critical system error.');
  }
  return _getAllProducts();
};

/**
 * Records a stock movement (IN or OUT)
 * @param productId - Product ID
 * @param quantity - Quantity (positive number)
 * @param type - Movement type: 'IN' or 'OUT'
 * @returns Created stock movement record
 * @throws {Error} If API initialization fails or movement creation fails
 */
export const addStockMovement: AddStockMovement = async (productId, quantity, type, note) => {
  await apiReady;
  if (!_addStockMovement) {
    throw new Error('addStockMovement function not available after initialization. This indicates a critical system error.');
  }
  return _addStockMovement(productId, quantity, type, note);
};

/**
 * Fetches stock movement history for a product
 * @param productId - Product ID
 * @returns Array of stock movements
 * @throws {Error} If API initialization fails or fetch fails
 */
export const getStockMovements: GetStockMovements = async (productId) => {
  await apiReady;
  if (!_getStockMovements) {
    throw new Error('getStockMovements function not available after initialization. This indicates a critical system error.');
  }
  return _getStockMovements(productId);
};

// Re-export error types for convenience
export { ValidationError, NetworkError, AuthorizationError } from './errors';
