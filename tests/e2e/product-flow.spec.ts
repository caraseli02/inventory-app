/**
 * E2E Tests: Product Flow
 *
 * Tests basic product search and interaction flows.
 */

import { test, expect } from '@playwright/test'

test.describe('Product Search', () => {
  test('should accept input via search field', async ({ page }) => {
    await page.goto('/')

    // Navigate to Scanner page
    const scannerCard = page.getByRole('button', { name: /manage stock|scanner/i })
    await scannerCard.click()
    await page.waitForLoadState('domcontentloaded')

    // Ensure we're in Search mode
    const searchInput = page.getByRole('combobox', { name: /search for products/i })
    try {
      await searchInput.waitFor({ state: 'visible', timeout: 2000 })
    } catch {
      const allSearchToggles = await page.getByText('Search').all()
      for (const toggle of allSearchToggles) {
        if (await toggle.isVisible()) {
          await toggle.click()
          break
        }
      }
      await searchInput.waitFor({ state: 'visible', timeout: 5000 })
    }

    await searchInput.fill('1234567890123')
    await expect(searchInput).toHaveValue('1234567890123')
  })
})
