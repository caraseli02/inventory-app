/**
 * Visual Regression Tests: Page Layouts
 *
 * These tests capture screenshots of key pages and compare them against baseline images.
 * Run with: pnpm test:visual
 * Update baseline: pnpm test:visual --update-snapshots
 */

import { test, expect } from '@playwright/test'

test.describe('Visual Regression: Page Layouts', () => {
  test('home page layout', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Wait for cards to be visible
    await page.waitForSelector('[role="button"]', { timeout: 5000 })

    // Take full page screenshot
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('scanner page layout', async ({ page }) => {
    await page.goto('/')

    // Navigate to scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Wait for scanner interface
    await page.waitForSelector('[role="main"]', { timeout: 5000 })

    // Take screenshot
    await expect(page).toHaveScreenshot('scanner-page.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('inventory page layout', async ({ page }) => {
    await page.goto('/')

    // Navigate to inventory page
    const inventoryCard = page.getByRole('button', { name: /view inventory|browse/i })
    await inventoryCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Wait for content
    await page.waitForSelector('[role="main"]', { timeout: 5000 })

    // Take screenshot
    await expect(page).toHaveScreenshot('inventory-page.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Visual Regression: Components', () => {
  test('product creation form', async ({ page }) => {
    await page.goto('/')

    // Navigate to scanner and trigger product creation
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Enter non-existent barcode
    const searchInput = page.getByPlaceholder(/search by name or barcode/i).first()
    await searchInput.fill('VISUAL-TEST-12345')
    await searchInput.press('Enter')

    // Click Add New
    const addNewButton = page.getByRole('button', { name: /add new|create/i })
    await addNewButton.click({ timeout: 5000 })

    // Wait for form
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
    await nameInput.waitFor({ state: 'visible', timeout: 5000 })

    // Take screenshot of form
    await expect(page).toHaveScreenshot('product-creation-form.png', {
      animations: 'disabled',
    })
  })
})

test.describe('Visual Regression: Responsive', () => {
  test('mobile viewport - home page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[role="button"]', { timeout: 5000 })

    await expect(page).toHaveScreenshot('home-page-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('tablet viewport - home page', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[role="button"]', { timeout: 5000 })

    await expect(page).toHaveScreenshot('home-page-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})
