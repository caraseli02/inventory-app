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
type AddStockMovement = (productId: string, quantity: number, type: 'IN' | 'OUT') => Promise<StockMovement>;
type GetStockMovements = (productId: string) => Promise<StockMovement[]>;

// Lazy-loaded API functions
let _getProductByBarcode: GetProductByBarcode;
let _createProduct: CreateProduct;
let _updateProduct: UpdateProduct;
let _deleteProduct: DeleteProduct;
let _getAllProducts: GetAllProducts;
let _addStockMovement: AddStockMovement;
let _getStockMovements: GetStockMovements;

// Initialize the API module
const initApi = async () => {
  if (useSupabase) {
    const supabaseApi = await import('./supabase-api');
    _getProductByBarcode = supabaseApi.getProductByBarcode;
    _createProduct = supabaseApi.createProduct;
    _updateProduct = supabaseApi.updateProduct;
    _deleteProduct = supabaseApi.deleteProduct;
    _getAllProducts = supabaseApi.getAllProducts;
    _addStockMovement = supabaseApi.addStockMovement;
    _getStockMovements = supabaseApi.getStockMovements;
  } else {
    const airtableApi = await import('./api');
    _getProductByBarcode = airtableApi.getProductByBarcode;
    _createProduct = airtableApi.createProduct;
    _updateProduct = airtableApi.updateProduct;
    _deleteProduct = airtableApi.deleteProduct;
    _getAllProducts = airtableApi.getAllProducts;
    _addStockMovement = airtableApi.addStockMovement;
    _getStockMovements = airtableApi.getStockMovements;
  }
};

// Initialize on module load
const apiReady = initApi();

// Export wrapper functions that wait for initialization
export const getProductByBarcode: GetProductByBarcode = async (barcode) => {
  await apiReady;
  return _getProductByBarcode(barcode);
};

export const createProduct: CreateProduct = async (data) => {
  await apiReady;
  return _createProduct(data);
};

export const updateProduct: UpdateProduct = async (productId, data) => {
  await apiReady;
  return _updateProduct(productId, data);
};

export const deleteProduct: DeleteProduct = async (productId) => {
  await apiReady;
  return _deleteProduct(productId);
};

export const getAllProducts: GetAllProducts = async () => {
  await apiReady;
  return _getAllProducts();
};

export const addStockMovement: AddStockMovement = async (productId, quantity, type) => {
  await apiReady;
  return _addStockMovement(productId, quantity, type);
};

export const getStockMovements: GetStockMovements = async (productId) => {
  await apiReady;
  return _getStockMovements(productId);
};

// Re-export error types for convenience
export { ValidationError, NetworkError, AuthorizationError } from './supabase-api';
