import { test, expect } from '@playwright/test';

test.describe('Invoice Upload Smoke', () => {
  test('uploads invoice through extraction endpoint without CSP console errors', async ({ page }) => {
    const cspViolations: string[] = [];
    const invoiceRequestUrls: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/content security policy|csp|violat/i.test(text)) {
        cspViolations.push(text);
      }
    });

    const fulfillInvoiceExtraction = async (route: Parameters<typeof page.route>[1] extends (route: infer R) => unknown ? R : never) => {
      invoiceRequestUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              name: 'Smoke Test Product',
              quantity: 2,
              unit_price: 1.5,
              total_price: 3.0,
              raw_code: '1234567890123',
            },
          ],
          supplier: 'Smoke Supplier',
          invoice_number: 'SMOKE-001',
          date: '2026-02-10',
          total_amount: 3.0,
        }),
      });
    };

    await page.route('**/api/extract-invoice', fulfillInvoiceExtraction);
    await page.route('**/extract', fulfillInvoiceExtraction);

    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/inventory$/);
    await page.locator('button[title="Import from Excel file"]').first().waitFor({ state: 'visible', timeout: 15000 });

    const importInvoiceButton = page.locator('button[title*="Import from Invoice"]').first();
    await expect(importInvoiceButton).toBeVisible({ timeout: 15000 });
    await importInvoiceButton.click();

    const fileInput = page.locator('input#invoice-upload');
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    await fileInput.setInputFiles({
      name: 'smoke-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 smoke test'),
    });

    await expect(page.getByText('Smoke Test Product')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/SMOKE-001/)).toBeVisible({ timeout: 10000 });

    expect(invoiceRequestUrls.length).toBeGreaterThan(0);
    // In dev, invoice extraction may use direct FastAPI URL (`/extract`) if VITE_INVOICE_API_URL is set.
    // In prod/proxy mode, it uses `/api/extract-invoice`.
    expect(
      invoiceRequestUrls.some((url) =>
        url.includes('/api/extract-invoice') || url.includes('/extract')
      )
    ).toBe(true);
    expect(cspViolations).toEqual([]);
  });
});
