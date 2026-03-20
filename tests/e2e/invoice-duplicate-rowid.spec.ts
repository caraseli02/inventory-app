import { test, expect } from '@playwright/test';

test.describe('Invoice Upload - duplicate OCR row_id', () => {
  test('removing a duplicate-row_id row does not remove its sibling after FX changes', async ({ page }) => {
    const keyWarnings: string[] = [];

    await page.addInitScript(() => {
      window.localStorage.setItem('preferredLanguage', 'en');
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (/Encountered two children with the same key/i.test(text)) keyWarnings.push(text);
    });

    const fulfillInvoiceExtraction = async (
      route: Parameters<typeof page.route>[1] extends (route: infer R) => unknown ? R : never,
    ) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              row_id: 'row-dup',
              name: 'Invoice Duplicate A',
              quantity: 1,
              unit_price: 10,
              total_price: 10,
              raw_code: '1234567890123',
              weight_kg_candidate: 0.5,
            },
            {
              row_id: 'row-dup',
              name: 'Invoice Duplicate B',
              quantity: 1,
              unit_price: 10,
              total_price: 10,
              raw_code: '1234567890124',
              weight_kg_candidate: 0.5,
            },
          ],
          supplier: 'Test Supplier',
          invoice_number: 'INV-DUP-001',
          date: '2026-03-20',
          total_amount: 20.0,
        }),
      });
    };

    await page.route('**/api/extract-invoice', fulfillInvoiceExtraction);
    await page.route('**/extract', fulfillInvoiceExtraction);

    const fulfillPricingPreview = async (
      route: Parameters<typeof page.route>[1] extends (route: infer R) => unknown ? R : never,
    ) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rows: [
            {
              row_id: 'row-dup',
              status: 'ok',
              computed: {
                base_price_eur: 1.11,
                transport_eur: 0.2,
                price_50: 1.66,
                price_70: 1.89,
                price_100: 2.22,
              },
            },
          ],
          summary: {
            ok_count: 1,
            needs_input_count: 0,
          },
        }),
      });
    };

    await page.route('**/api/invoice/preview-pricing', fulfillPricingPreview);
    await page.route('**/invoice/preview-pricing', fulfillPricingPreview);

    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/inventory$/);

    const importInvoiceButton = page.locator('button[title*="Import from Invoice"]').first();
    await expect(importInvoiceButton).toBeVisible({ timeout: 15000 });
    await importInvoiceButton.click();

    const fileInput = page.locator('input#invoice-upload');
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    await fileInput.setInputFiles({
      name: 'duplicate-rowid-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 duplicate row_id test'),
    });

    await expect(page.getByText('Invoice Duplicate A')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Invoice Duplicate B')).toBeVisible({ timeout: 10000 });

    const removeButtons = page.locator('button[title="Remove product"]');
    await expect(removeButtons.first()).toBeVisible({ timeout: 5000 });
    await removeButtons.first().click();

    await expect(page.getByText('Invoice Duplicate A')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Invoice Duplicate B')).toBeVisible({ timeout: 10000 });

    const fxInput = page.locator('input[placeholder="Enter rate"]');
    await expect(fxInput).toBeVisible({ timeout: 5000 });
    await fxInput.fill('20');

    await expect(page.getByText('Invoice Duplicate A')).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Invoice Duplicate B')).toBeVisible({ timeout: 10000 });

    expect(keyWarnings).toEqual([]);
  });
});

