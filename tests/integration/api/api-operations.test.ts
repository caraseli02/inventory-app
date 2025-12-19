/**
 * Integration Tests: API Operations
 *
 * Tests the core API operations using mock implementations.
 * These tests verify the business logic of CRUD operations
 * independent of the specific backend (Supabase/Airtable).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  mockGetProductByBarcode,
  mockCreateProduct,
  mockUpdateProduct,
  mockDeleteProduct,
  mockGetAllProducts,
  mockAddStockMovement,
  mockGetStockMovements,
  resetMocks,
  seedProducts,
  mockProducts,
} from '@/test/mocks/api'
import { createProduct, createProducts } from '@/test/factories'

describe('API Operations', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('getProductByBarcode', () => {
    it('should return product when barcode matches', async () => {
      const product = createProduct({
        fields: { Name: 'Test Product', Barcode: '1234567890123' },
      })
      seedProducts([product])

      const result = await mockGetProductByBarcode('1234567890123')

      expect(result).not.toBeNull()
      expect(result?.fields.Name).toBe('Test Product')
      expect(result?.fields.Barcode).toBe('1234567890123')
    })

    it('should return null when barcode not found', async () => {
      const result = await mockGetProductByBarcode('9999999999999')

      expect(result).toBeNull()
    })

    it('should handle empty database', async () => {
      const result = await mockGetProductByBarcode('1234567890123')

      expect(result).toBeNull()
    })

    it('should find correct product among multiple', async () => {
      const products = [
        createProduct({ fields: { Name: 'Product A', Barcode: '111' } }),
        createProduct({ fields: { Name: 'Product B', Barcode: '222' } }),
        createProduct({ fields: { Name: 'Product C', Barcode: '333' } }),
      ]
      seedProducts(products)

      const result = await mockGetProductByBarcode('222')

      expect(result?.fields.Name).toBe('Product B')
    })

    it('should handle products without barcodes', async () => {
      const product = createProduct({
        fields: { Name: 'No Barcode', Barcode: undefined },
      })
      seedProducts([product])

      const result = await mockGetProductByBarcode('anything')

      expect(result).toBeNull()
    })
  })

  describe('createProduct', () => {
    it('should create product with all fields', async () => {
      const result = await mockCreateProduct({
        Name: 'New Product',
        Barcode: '1234567890123',
        Category: 'Beverages',
        Price: 9.99,
        'Price 50%': 14.99,
        'Price 70%': 16.99,
        'Price 100%': 19.99,
        Markup: 50,
        Supplier: 'Test Supplier',
      })

      expect(result.id).toBeDefined()
      expect(result.fields.Name).toBe('New Product')
      expect(result.fields.Barcode).toBe('1234567890123')
      expect(result.fields.Category).toBe('Beverages')
      expect(result.fields.Price).toBe(9.99)
      expect(result.fields['Current Stock Level']).toBe(0)
    })

    it('should create product with minimal fields', async () => {
      const result = await mockCreateProduct({
        Name: 'Minimal Product',
      })

      expect(result.fields.Name).toBe('Minimal Product')
      expect(result.fields.Barcode).toBeUndefined()
      expect(result.fields.Price).toBeUndefined()
    })

    it('should add product to database', async () => {
      const result = await mockCreateProduct({ Name: 'Test' })

      expect(mockProducts.has(result.id)).toBe(true)
    })

    it('should handle image URL', async () => {
      const result = await mockCreateProduct({
        Name: 'With Image',
        Image: 'https://example.com/image.jpg',
      })

      expect(result.fields.Image).toEqual([{ url: 'https://example.com/image.jpg' }])
    })

    it('should initialize stock at zero', async () => {
      const result = await mockCreateProduct({ Name: 'New Stock' })

      expect(result.fields['Current Stock Level']).toBe(0)
    })
  })

  describe('updateProduct', () => {
    it('should update product name', async () => {
      const product = createProduct({ fields: { Name: 'Original' } })
      seedProducts([product])

      const result = await mockUpdateProduct(product.id, { Name: 'Updated' })

      expect(result.fields.Name).toBe('Updated')
    })

    it('should update multiple fields', async () => {
      const product = createProduct({
        fields: { Name: 'Original', Price: 5.0 },
      })
      seedProducts([product])

      const result = await mockUpdateProduct(product.id, {
        Name: 'Updated',
        Price: 10.0,
        Category: 'New Category',
      })

      expect(result.fields.Name).toBe('Updated')
      expect(result.fields.Price).toBe(10.0)
      expect(result.fields.Category).toBe('New Category')
    })

    it('should preserve unchanged fields', async () => {
      const product = createProduct({
        fields: { Name: 'Original', Barcode: '123', Category: 'General' },
      })
      seedProducts([product])

      const result = await mockUpdateProduct(product.id, { Name: 'Updated' })

      expect(result.fields.Name).toBe('Updated')
      expect(result.fields.Barcode).toBe('123')
      expect(result.fields.Category).toBe('General')
    })

    it('should throw error for non-existent product', async () => {
      await expect(
        mockUpdateProduct('non-existent', { Name: 'Test' })
      ).rejects.toThrow('not found')
    })

    it('should update image URL', async () => {
      const product = createProduct({
        fields: { Name: 'Test', Image: [{ url: 'old.jpg' }] },
      })
      seedProducts([product])

      const result = await mockUpdateProduct(product.id, {
        Image: 'new.jpg',
      })

      expect(result.fields.Image).toEqual([{ url: 'new.jpg' }])
    })
  })

  describe('deleteProduct', () => {
    it('should remove product from database', async () => {
      const product = createProduct()
      seedProducts([product])

      await mockDeleteProduct(product.id)

      expect(mockProducts.has(product.id)).toBe(false)
    })

    it('should throw error for non-existent product', async () => {
      await expect(mockDeleteProduct('non-existent')).rejects.toThrow(
        'not found'
      )
    })

    it('should also remove stock movements', async () => {
      const product = createProduct()
      seedProducts([product])
      await mockAddStockMovement(product.id, 10, 'IN')

      await mockDeleteProduct(product.id)

      const movements = await mockGetStockMovements(product.id)
      expect(movements).toEqual([])
    })
  })

  describe('getAllProducts', () => {
    it('should return empty array when no products', async () => {
      const result = await mockGetAllProducts()

      expect(result).toEqual([])
    })

    it('should return all products', async () => {
      const products = createProducts(5)
      seedProducts(products)

      const result = await mockGetAllProducts()

      expect(result).toHaveLength(5)
    })

    it('should include all product fields', async () => {
      const product = createProduct({
        fields: {
          Name: 'Full Product',
          Barcode: '123',
          Category: 'Test',
          Price: 9.99,
          'Current Stock Level': 50,
        },
      })
      seedProducts([product])

      const result = await mockGetAllProducts()

      expect(result[0].fields.Name).toBe('Full Product')
      expect(result[0].fields.Barcode).toBe('123')
      expect(result[0].fields.Category).toBe('Test')
      expect(result[0].fields.Price).toBe(9.99)
      expect(result[0].fields['Current Stock Level']).toBe(50)
    })
  })

  describe('addStockMovement', () => {
    it('should add IN movement', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 0 },
      })
      seedProducts([product])

      const result = await mockAddStockMovement(product.id, 10, 'IN')

      expect(result.fields.Type).toBe('IN')
      expect(result.fields.Quantity).toBe(10)
    })

    it('should add OUT movement with negative quantity', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 20 },
      })
      seedProducts([product])

      const result = await mockAddStockMovement(product.id, 5, 'OUT')

      expect(result.fields.Type).toBe('OUT')
      expect(result.fields.Quantity).toBe(-5)
    })

    it('should update product stock level for IN', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 10 },
      })
      seedProducts([product])

      await mockAddStockMovement(product.id, 5, 'IN')

      const updated = mockProducts.get(product.id)
      expect(updated?.fields['Current Stock Level']).toBe(15)
    })

    it('should update product stock level for OUT', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 10 },
      })
      seedProducts([product])

      await mockAddStockMovement(product.id, 3, 'OUT')

      const updated = mockProducts.get(product.id)
      expect(updated?.fields['Current Stock Level']).toBe(7)
    })

    it('should throw error for non-existent product', async () => {
      await expect(
        mockAddStockMovement('non-existent', 10, 'IN')
      ).rejects.toThrow('not found')
    })

    it('should include date in movement', async () => {
      const product = createProduct()
      seedProducts([product])

      const result = await mockAddStockMovement(product.id, 1, 'IN')

      expect(result.fields.Date).toBeDefined()
      expect(new Date(result.fields.Date).getTime()).not.toBeNaN()
    })

    it('should link movement to product', async () => {
      const product = createProduct()
      seedProducts([product])

      const result = await mockAddStockMovement(product.id, 1, 'IN')

      expect(result.fields.Product).toContain(product.id)
    })
  })

  describe('getStockMovements', () => {
    it('should return empty array for product with no movements', async () => {
      const product = createProduct()
      seedProducts([product])

      const result = await mockGetStockMovements(product.id)

      expect(result).toEqual([])
    })

    it('should return all movements for product', async () => {
      const product = createProduct()
      seedProducts([product])

      await mockAddStockMovement(product.id, 10, 'IN')
      await mockAddStockMovement(product.id, 5, 'OUT')
      await mockAddStockMovement(product.id, 3, 'IN')

      const result = await mockGetStockMovements(product.id)

      expect(result).toHaveLength(3)
    })

    it('should not return movements from other products', async () => {
      const product1 = createProduct({ id: 'prod1' })
      const product2 = createProduct({ id: 'prod2' })
      seedProducts([product1, product2])

      await mockAddStockMovement(product1.id, 10, 'IN')
      await mockAddStockMovement(product2.id, 20, 'IN')

      const result = await mockGetStockMovements(product1.id)

      expect(result).toHaveLength(1)
      expect(result[0].fields.Quantity).toBe(10)
    })
  })

  describe('Stock Calculation', () => {
    it('should calculate correct stock from multiple movements', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 0 },
      })
      seedProducts([product])

      await mockAddStockMovement(product.id, 100, 'IN')
      await mockAddStockMovement(product.id, 30, 'OUT')
      await mockAddStockMovement(product.id, 15, 'IN')
      await mockAddStockMovement(product.id, 25, 'OUT')

      const updated = mockProducts.get(product.id)
      expect(updated?.fields['Current Stock Level']).toBe(60) // 100 - 30 + 15 - 25
    })

    it('should allow stock to go negative', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 5 },
      })
      seedProducts([product])

      await mockAddStockMovement(product.id, 10, 'OUT')

      const updated = mockProducts.get(product.id)
      expect(updated?.fields['Current Stock Level']).toBe(-5)
    })

    it('should handle large quantities', async () => {
      const product = createProduct({
        fields: { 'Current Stock Level': 0 },
      })
      seedProducts([product])

      await mockAddStockMovement(product.id, 1000000, 'IN')

      const updated = mockProducts.get(product.id)
      expect(updated?.fields['Current Stock Level']).toBe(1000000)
    })
  })
})
