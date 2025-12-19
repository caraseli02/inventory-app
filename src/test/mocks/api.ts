/**
 * Mock API Implementations
 *
 * These mocks simulate the API layer behavior for testing.
 * They can be configured to return specific responses or throw errors.
 */

import { vi } from 'vitest'
import type { Product, StockMovement } from '@/types'
import type { CreateProductDTO } from '@/lib/api-provider'
import { createProduct, createStockMovement, generateId } from '../factories'

/**
 * Mock product database
 */
export const mockProducts = new Map<string, Product>()
export const mockMovements = new Map<string, StockMovement[]>()

/**
 * Reset all mock data
 */
export function resetMockData(): void {
  mockProducts.clear()
  mockMovements.clear()
}

/**
 * Seed mock data with products
 */
export function seedProducts(products: Product[]): void {
  products.forEach((p) => mockProducts.set(p.id, p))
}

/**
 * Mock getProductByBarcode implementation
 */
export const mockGetProductByBarcode = vi.fn(
  async (barcode: string): Promise<Product | null> => {
    for (const product of mockProducts.values()) {
      if (product.fields.Barcode === barcode) {
        return product
      }
    }
    return null
  }
)

/**
 * Mock createProduct implementation
 */
export const mockCreateProduct = vi.fn(
  async (data: CreateProductDTO): Promise<Product> => {
    const product = createProduct({
      id: generateId('prod'),
      fields: {
        Name: data.Name,
        Barcode: data.Barcode,
        Category: data.Category,
        Price: data.Price,
        'Price 50%': data['Price 50%'],
        'Price 70%': data['Price 70%'],
        'Price 100%': data['Price 100%'],
        Markup: data.Markup,
        'Expiry Date': data['Expiry Date'],
        'Min Stock Level': data['Min Stock Level'],
        'Ideal Stock': data['Ideal Stock'],
        Supplier: data.Supplier,
        Image: data.Image ? [{ url: data.Image }] : undefined,
        'Current Stock Level': 0,
      },
    })
    mockProducts.set(product.id, product)
    return product
  }
)

/**
 * Mock updateProduct implementation
 */
export const mockUpdateProduct = vi.fn(
  async (
    productId: string,
    data: Partial<CreateProductDTO>
  ): Promise<Product> => {
    const existing = mockProducts.get(productId)
    if (!existing) {
      throw new Error(`Product ${productId} not found`)
    }

    const updated = {
      ...existing,
      fields: {
        ...existing.fields,
        ...data,
        Image:
          data.Image !== undefined
            ? data.Image
              ? [{ url: data.Image }]
              : undefined
            : existing.fields.Image,
      },
    }
    mockProducts.set(productId, updated)
    return updated
  }
)

/**
 * Mock deleteProduct implementation
 */
export const mockDeleteProduct = vi.fn(async (productId: string): Promise<void> => {
  if (!mockProducts.has(productId)) {
    throw new Error(`Product ${productId} not found`)
  }
  mockProducts.delete(productId)
  mockMovements.delete(productId)
})

/**
 * Mock getAllProducts implementation
 */
export const mockGetAllProducts = vi.fn(async (): Promise<Product[]> => {
  return Array.from(mockProducts.values())
})

/**
 * Mock addStockMovement implementation
 */
export const mockAddStockMovement = vi.fn(
  async (
    productId: string,
    quantity: number,
    type: 'IN' | 'OUT'
  ): Promise<StockMovement> => {
    if (!mockProducts.has(productId)) {
      throw new Error(`Product ${productId} not found`)
    }

    const signedQuantity = type === 'IN' ? quantity : -Math.abs(quantity)
    const movement = createStockMovement({
      id: generateId('mov'),
      fields: {
        Product: [productId],
        Type: type,
        Quantity: signedQuantity,
        Date: new Date().toISOString(),
      },
    })

    const productMovements = mockMovements.get(productId) || []
    productMovements.push(movement)
    mockMovements.set(productId, productMovements)

    // Update product stock level
    const product = mockProducts.get(productId)!
    const currentStock = product.fields['Current Stock Level'] || 0
    product.fields['Current Stock Level'] = currentStock + signedQuantity
    mockProducts.set(productId, product)

    return movement
  }
)

/**
 * Mock getStockMovements implementation
 */
export const mockGetStockMovements = vi.fn(
  async (productId: string): Promise<StockMovement[]> => {
    return mockMovements.get(productId) || []
  }
)

/**
 * Create a mock API module
 */
export function createMockApiModule() {
  return {
    getProductByBarcode: mockGetProductByBarcode,
    createProduct: mockCreateProduct,
    updateProduct: mockUpdateProduct,
    deleteProduct: mockDeleteProduct,
    getAllProducts: mockGetAllProducts,
    addStockMovement: mockAddStockMovement,
    getStockMovements: mockGetStockMovements,
  }
}

/**
 * Reset all mock functions
 */
export function resetMocks(): void {
  mockGetProductByBarcode.mockClear()
  mockCreateProduct.mockClear()
  mockUpdateProduct.mockClear()
  mockDeleteProduct.mockClear()
  mockGetAllProducts.mockClear()
  mockAddStockMovement.mockClear()
  mockGetStockMovements.mockClear()
  resetMockData()
}
