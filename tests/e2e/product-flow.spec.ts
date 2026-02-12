/**
 * E2E Tests: Product Flow
 *
 * Tests basic product search and interaction flows.
 */

import { test, expect } from '@playwright/test'

test.describe('Product Search', () => {
  test('should accept input via search field', async ({ page }) => {
    await page.goto('/manage')
    await expect(page).toHaveURL(/\/manage$/)

    // ScanPage renders mobile + desktop DOM; pick a visible combobox input.
    const searchInput = page.locator('input[role="combobox"]:visible').first()
    await expect(searchInput).toBeVisible({ timeout: 15000 })

    await searchInput.fill('1234567890123')
    await expect(searchInput).toHaveValue('1234567890123')
  })
})
