import { test, expect } from '@playwright/test'

test.describe('Refresh-Safe Routing', () => {
  test('should stay on inventory after reload', async ({ page }) => {
    await page.goto('/inventory')
    await expect(page).toHaveURL(/\/inventory$/)

    await page.reload()
    await expect(page).toHaveURL(/\/inventory$/)
  })

  test('should restore checkout cart after reload', async ({ page }) => {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      items: [
        {
          product: {
            id: 'p1',
            createdTime: new Date().toISOString(),
            fields: {
              Name: 'Apple',
              Category: 'General',
              Price: 1.5,
              'Current Stock Level': 10,
            },
          },
          quantity: 2,
        },
      ],
    }

    await page.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, value)
    }, { key: 'checkoutCart:v1', value: JSON.stringify(payload) })

    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.locator('[data-testid="cart-items"]').getByText('Apple')).toBeVisible({ timeout: 15_000 })

    await page.reload()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.locator('[data-testid="cart-items"]').getByText('Apple')).toBeVisible({ timeout: 15_000 })
  })
})
