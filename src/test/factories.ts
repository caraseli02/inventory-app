/**
 * Test Factories
 *
 * Factory functions for creating test data with sensible defaults.
 * These help create consistent test fixtures across all test files.
 */

import type { Product, StockMovement, CartItem } from '@/types'

let idCounter = 0

/**
 * Generate a unique test ID
 */
export function generateId(prefix = 'test'): string {
  idCounter++
  return `${prefix}_${idCounter}_${Date.now()}`
}

/**
 * Reset ID counter between test suites
 */
export function resetIdCounter(): void {
  idCounter = 0
}

/**
 * Create a test product with defaults
 */
export function createProduct(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? generateId('prod')
  const defaults: Product = {
    id,
    createdTime: new Date().toISOString(),
    fields: {
      Name: 'Test Product',
      Barcode: '1234567890123',
      Category: 'General',
      Price: 9.99,
      'Current Stock Level': 10,
      'Min Stock Level': 5,
    },
  }

  return {
    ...defaults,
    ...overrides,
    fields: {
      ...defaults.fields,
      ...overrides.fields,
    },
  }
}

/**
 * Create a product without a barcode (for xlsx import scenarios)
 */
export function createProductWithoutBarcode(
  overrides: Partial<Product> = {}
): Product {
  return createProduct({
    ...overrides,
    fields: {
      Name: 'Product Without Barcode',
      Category: 'General',
      Price: 5.99,
      ...overrides.fields,
      Barcode: undefined,
    },
  })
}

/**
 * Create a low stock product
 */
export function createLowStockProduct(
  overrides: Partial<Product> = {}
): Product {
  return createProduct({
    ...overrides,
    fields: {
      Name: 'Low Stock Product',
      'Current Stock Level': 2,
      'Min Stock Level': 5,
      ...overrides.fields,
    },
  })
}

/**
 * Create a product with all price tiers
 */
export function createProductWithPriceTiers(
  overrides: Partial<Product> = {}
): Product {
  return createProduct({
    ...overrides,
    fields: {
      Name: 'Product with Tiers',
      Price: 10.0,
      'Price 50%': 15.0,
      'Price 70%': 17.0,
      'Price 100%': 20.0,
      Markup: 50,
      ...overrides.fields,
    },
  })
}

/**
 * Create a stock movement
 */
export function createStockMovement(
  overrides: Partial<StockMovement> = {}
): StockMovement {
  const defaults: StockMovement = {
    id: generateId('mov'),
    fields: {
      Product: ['prod_1'],
      Type: 'IN',
      Quantity: 10,
      Date: new Date().toISOString(),
    },
  }

  return {
    ...defaults,
    ...overrides,
    fields: {
      ...defaults.fields,
      ...overrides.fields,
    },
  }
}

/**
 * Create an IN stock movement
 */
export function createInMovement(
  productId: string,
  quantity: number,
  overrides: Partial<StockMovement['fields']> = {}
): StockMovement {
  return createStockMovement({
    fields: {
      Product: [productId],
      Type: 'IN',
      Quantity: quantity,
      Date: new Date().toISOString(),
      ...overrides,
    },
  })
}

/**
 * Create an OUT stock movement
 */
export function createOutMovement(
  productId: string,
  quantity: number,
  overrides: Partial<StockMovement['fields']> = {}
): StockMovement {
  return createStockMovement({
    fields: {
      Product: [productId],
      Type: 'OUT',
      Quantity: -Math.abs(quantity), // Ensure negative for OUT
      Date: new Date().toISOString(),
      ...overrides,
    },
  })
}

/**
 * Create a cart item
 */
export function createCartItem(
  overrides: Partial<CartItem> = {}
): CartItem {
  const defaults: CartItem = {
    product: createProduct(),
    quantity: 1,
    status: 'idle',
  }

  return {
    ...defaults,
    ...overrides,
  }
}

/**
 * Create multiple products
 */
export function createProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, i) =>
    createProduct({
      id: generateId('prod'),
      fields: {
        Name: `Product ${i + 1}`,
        Barcode: `123456789${String(i).padStart(4, '0')}`,
        Category: i % 2 === 0 ? 'General' : 'Beverages',
        'Current Stock Level': 10 + i,
      },
    })
  )
}

/**
 * Create a mock OpenFoodFacts API response
 */
export function createOFFResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 1,
    product: {
      product_name: 'Test OFF Product',
      categories_tags: ['en:beverages', 'en:sodas'],
      image_url: 'https://example.com/image.jpg',
      ...overrides,
    },
  }
}

/**
 * Create an empty/not found OpenFoodFacts response
 */
export function createEmptyOFFResponse() {
  return {
    status: 0,
    product: null,
  }
}
