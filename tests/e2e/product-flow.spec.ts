/**
 * E2E Tests: Product Creation Flow
 *
 * Tests the product creation and management flows.
 * Covers form validation, dialog interactions, and data persistence.
 */

import { test, expect } from '@playwright/test'

test.describe('Product Creation', () => {
  test('should open create product dialog from scan page', async ({ page }) => {
    await page.goto('/')

    // Look for "Add Product" or "Create Product" button - fail if not found
    const addButton = page
      .getByRole('button', { name: /add|create|new/i })
      .first()

    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Dialog should open - wait for it with proper assertion
    const dialog = page.locator('[role="dialog"], [data-state="open"]')
    await expect(dialog.first()).toBeVisible({ timeout: 5000 })
  })

  test('should show required field validation', async ({ page }) => {
    await page.goto('/')

    // Open create dialog
    const addButton = page
      .getByRole('button', { name: /add|create|new/i })
      .first()

    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Try to submit without filling required fields
    const submitButton = page.locator(
      '[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create")'
    )

    await expect(submitButton.first()).toBeVisible({ timeout: 5000 })
    await submitButton.first().click()

    // Should show validation error or prevent submission
    // The form should still be open (not closed on invalid submit)
    await expect(dialog).toBeVisible()
  })

  test('should have name field in product form', async ({ page }) => {
    await page.goto('/')

    const addButton = page
      .getByRole('button', { name: /add|create|new/i })
      .first()

    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })

    // Look for name input - fail if not found
    const nameInput = page.locator(
      '[role="dialog"] input[name="name"], [role="dialog"] input[placeholder*="name" i], [role="dialog"] label:has-text("Name") + input, [role="dialog"] label:has-text("Name") ~ input'
    )

    await expect(nameInput.first()).toBeVisible({ timeout: 5000 })

    // Fill in the name
    await nameInput.first().fill('Test Product')
    await expect(nameInput.first()).toHaveValue('Test Product')
  })

  test('should close dialog on cancel', async ({ page }) => {
    await page.goto('/')

    const addButton = page
      .getByRole('button', { name: /add|create|new/i })
      .first()

    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Wait for dialog with proper assertion instead of waitForTimeout
    const dialog = page.locator('[role="dialog"], [data-state="open"]')
    await expect(dialog.first()).toBeVisible({ timeout: 5000 })

    // Close the dialog
    const closeButton = page.locator(
      '[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("Cancel"), button:has-text("Cancel"), [data-dismiss]'
    )

    await expect(closeButton.first()).toBeVisible({ timeout: 5000 })
    await closeButton.first().click()

    // Dialog should close - verify by checking it's gone
    await expect(dialog.first()).toBeHidden({ timeout: 5000 })
  })
})

test.describe('Product Form Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    const addButton = page
      .getByRole('button', { name: /add|create|new/i })
      .first()

    await expect(addButton).toBeVisible({ timeout: 5000 })
    await addButton.click()

    // Wait for dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
  })

  test('should have category selection', async ({ page }) => {
    // Look for category select - fail if not found
    const categorySelect = page.locator(
      '[role="dialog"] select[name="category"], [role="dialog"] [role="combobox"], [role="dialog"] label:has-text("Category") ~ [role="combobox"], [role="dialog"] button:has-text("Category")'
    )

    await expect(categorySelect.first()).toBeVisible({ timeout: 5000 })
  })

  test('should have price input', async ({ page }) => {
    // Look for price input - fail if not found
    const priceInput = page.locator(
      '[role="dialog"] input[name="price"], [role="dialog"] input[type="number"]:near(:text("Price")), [role="dialog"] label:has-text("Price") ~ input'
    )

    await expect(priceInput.first()).toBeVisible({ timeout: 5000 })

    await priceInput.first().fill('9.99')
    await expect(priceInput.first()).toHaveValue('9.99')
  })
})

test.describe('Manual Barcode Entry', () => {
  test('should have manual barcode entry option', async ({ page }) => {
    await page.goto('/')

    // Look for manual entry button or input - fail if not found
    const manualEntry = page.locator(
      'button:has-text("Manual"), input[placeholder*="barcode" i], [data-testid="manual-entry"], input[name="barcode"]'
    )

    await expect(manualEntry.first()).toBeVisible({ timeout: 5000 })
  })

  test('should accept valid barcode input', async ({ page }) => {
    await page.goto('/')

    const barcodeInput = page.getByPlaceholder(/barcode|code/i)

    await expect(barcodeInput.first()).toBeVisible({ timeout: 5000 })

    await barcodeInput.first().fill('1234567890123')
    await expect(barcodeInput.first()).toHaveValue('1234567890123')
  })
})
