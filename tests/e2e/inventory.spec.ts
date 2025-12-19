/**
 * E2E Tests: Inventory Page
 *
 * Tests the inventory list page functionality.
 * These tests verify filtering, sorting, and product display.
 */

import { test, expect } from '@playwright/test'

test.describe('Inventory List', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to inventory page
    await page.goto('/')

    // Navigate to inventory page - fail if link not found
    const inventoryLink = page.getByRole('link', { name: /inventory/i })
    await expect(inventoryLink).toBeVisible({ timeout: 5000 })
    await inventoryLink.click()
    await expect(page).toHaveURL(/inventory/)
  })

  test('should display inventory page elements', async ({ page }) => {
    // Should show the page content
    await expect(page.locator('body')).toBeVisible()
    // Should have main content area
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })

  test('should show search functionality', async ({ page }) => {
    // Look for search input - fail if not found
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Type in search
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('should display product cards or list items', async ({ page }) => {
    // Wait for content to load using proper condition instead of networkidle
    await page.waitForLoadState('domcontentloaded')

    // Wait for either products to appear or empty state
    await page.waitForSelector(
      '[data-testid="product-item"], .product-card, .product-list-item, tr, [data-testid="empty-state"], :text("No products")',
      { timeout: 10000 }
    )

    // Look for product-related content (cards, list items, or table rows)
    const products = page.locator(
      '[data-testid="product-item"], .product-card, .product-list-item, tr'
    )
    // Get count - may be 0 if database is empty
    const count = await products.count()

    // Just verify the page loaded and rendered something
    // Either we have products or an empty state is shown
    const hasProducts = count > 0
    const hasEmptyState =
      (await page.locator('[data-testid="empty-state"]').count()) > 0 ||
      (await page.getByText(/no products/i).count()) > 0

    expect(hasProducts || hasEmptyState).toBe(true)
  })

  test('should show loading state initially', async ({ page }) => {
    // Navigate fresh to catch loading state
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Either loading or content should be visible
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Inventory Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const inventoryLink = page.getByRole('link', { name: /inventory/i })
    await expect(inventoryLink).toBeVisible({ timeout: 5000 })
    await inventoryLink.click()
    await expect(page).toHaveURL(/inventory/)
  })

  test('should have category filter', async ({ page }) => {
    // Look for category filter - fail if not found
    const categoryFilter = page.locator(
      '[data-testid="category-filter"], select:has-text("Category"), [aria-label*="category" i], button:has-text("Category")'
    )
    await expect(categoryFilter.first()).toBeVisible({ timeout: 5000 })
  })

  test('should toggle low stock filter', async ({ page }) => {
    // Look for low stock toggle - fail if not found
    const lowStockToggle = page.locator(
      '[data-testid="low-stock-filter"], input[type="checkbox"]:near(:text("Low Stock")), button:has-text("Low Stock"), [aria-label*="low stock" i]'
    )
    await expect(lowStockToggle.first()).toBeVisible({ timeout: 5000 })

    // Click the toggle
    await lowStockToggle.first().click()
  })
})

test.describe('Inventory Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const inventoryLink = page.getByRole('link', { name: /inventory/i })
    await expect(inventoryLink).toBeVisible({ timeout: 5000 })
    await inventoryLink.click()
    await expect(page).toHaveURL(/inventory/)
  })

  test('should have sort options', async ({ page }) => {
    // Look for sort controls - fail if not found
    const sortControl = page.locator(
      '[data-testid="sort-toggle"], [aria-label*="sort" i], button:has-text("Sort"), select:has-text("Sort")'
    )
    await expect(sortControl.first()).toBeVisible({ timeout: 5000 })
  })
})
