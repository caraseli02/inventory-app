import { test, expect } from '@playwright/test';

test('Import products with console monitoring', async ({ page }) => {
  const consoleLogs: Array<{ type: string; text: string }> = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  const apiCalls: Array<{ url: string; method: string; status: number }> = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('supabase') || url.includes('/api/')) {
      apiCalls.push({
        url: url,
        method: response.request().method(),
        status: response.status()
      });
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const viewInventoryButton = page.getByRole('button', { name: /view inventory|browse/i });
  await viewInventoryButton.click();
  await page.waitForTimeout(2000);

  const importButton = page.getByRole('button', { name: /import/i }).first();
  await importButton.click();
  await page.waitForTimeout(1000);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('/Users/vladislavcaraseli/Documents/inventory-app/public/magazin.xlsx');
  await page.waitForTimeout(3000);

  const importConfirmButton = page.getByRole('button', { name: /import.*product/i });
  await importConfirmButton.click();

  const doneButton = page.getByRole('button', { name: /done/i });
  await expect(doneButton).toBeVisible({ timeout: 60000 });
  
  await doneButton.click();
  await page.waitForTimeout(2000);

  console.log('\n=== API Calls Summary ===');
  apiCalls.forEach(call => {
    console.log(call.method + ' ' + call.url + ' - Status: ' + call.status);
  });

  console.log('\nTotal Supabase/API calls: ' + apiCalls.length);

  const productRows = page.locator('table tbody tr');
  const count = await productRows.count();
  console.log('\nProducts in list after import: ' + count);
  
  expect(count).toBe(12);
});
