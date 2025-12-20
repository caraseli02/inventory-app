/**
 * E2E Tests: Product Creation Flow
 *
 * Tests the product creation and management flows.
 * Covers form validation, dialog interactions, and data persistence.
 */

import { test, expect } from '@playwright/test'

test.describe('Product Creation', () => {
  test('should open create product form after scanning non-existent barcode', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await expect(scannerCard).toBeVisible({ timeout: 5000 })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Switch to Search mode (if not already) and enter a non-existent barcode
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Enter a barcode that doesn't exist
    await searchInput.fill('TESTNONEXISTENT123')
    await searchInput.press('Enter')

    // Wait for "Product Not Found" or "Add New" button to appear
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await expect(addNewButton).toBeVisible({ timeout: 5000 })

    // Click to open create form
    await addNewButton.click()

    // Form should be visible (not a dialog, but an in-page form)
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
  })

  test('should show required field validation', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page and trigger product creation
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Enter non-existent barcode
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await searchInput.fill('TESTNONEXISTENT456')
    await searchInput.press('Enter')

    // Click "Add New"
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await expect(addNewButton).toBeVisible({ timeout: 5000 })
    await addNewButton.click()

    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /save|create|add product/i })
    await expect(submitButton).toBeVisible({ timeout: 5000 })
    await submitButton.click()

    // Should show validation error or prevent submission
    // Form should still be visible (not closed on invalid submit)
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await expect(nameInput).toBeVisible()
  })

  test('should have name field in product form', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page and trigger product creation
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Enter non-existent barcode and click Add New
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await searchInput.fill('TESTNONEXISTENT789')
    await searchInput.press('Enter')
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await addNewButton.click()

    // Look for name input
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Fill in the name
    await nameInput.fill('Test Product')
    await expect(nameInput).toHaveValue('Test Product')
  })

  test('should close form on cancel', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page and trigger product creation
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Enter non-existent barcode and click Add New
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await searchInput.fill('TESTNONEXISTENT000')
    await searchInput.press('Enter')
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await addNewButton.click()

    // Wait for form
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Close the form
    const cancelButton = page.getByRole('button', { name: /cancel|back|close/i })
    await expect(cancelButton).toBeVisible({ timeout: 5000 })
    await cancelButton.click()

    // Form should close - verify by checking name input is gone
    await expect(nameInput).toBeHidden({ timeout: 5000 })
  })
})

test.describe('Product Form Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Enter non-existent barcode to trigger product creation
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await searchInput.fill('TESTNONEXISTENT999')
    await searchInput.press('Enter')

    // Click "Add New" to open form
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await expect(addNewButton).toBeVisible({ timeout: 5000 })
    await addNewButton.click()

    // Wait for form to be visible
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
  })

  test('should have category selection', async ({ page }) => {
    // Look for category select/combobox
    const categorySelect = page.locator(
      'select[name="category"], [role="combobox"], button:has-text("Category")'
    )
    await expect(categorySelect.first()).toBeVisible({ timeout: 5000 })
  })

  test('should have price input', async ({ page }) => {
    // Look for price input
    const priceInput = page.locator(
      'input[name="price"], input[type="number"]'
    ).first()

    await expect(priceInput).toBeVisible({ timeout: 5000 })

    await priceInput.fill('9.99')
    await expect(priceInput).toHaveValue('9.99')
  })
})

test.describe('Manual Barcode Entry', () => {
  test('should have search/scan modes on scanner page', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Should have search input (Search mode) - already visible by default
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Should have mode toggle (Search/Scan tabs)
    const scanButton = page.getByRole('button', { name: /scan/i })
    await expect(scanButton).toBeVisible({ timeout: 5000 })
  })

  test('should accept barcode via search input', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Use search input to enter a barcode
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    await searchInput.fill('1234567890123')
    await expect(searchInput).toHaveValue('1234567890123')
  })
})
