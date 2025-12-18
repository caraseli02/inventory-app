import { test, expect } from '@playwright/test';
import path from 'path';

test('Import products from xlsx file', async ({ page }) => {
  // Navigate to home page
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  console.log('Step 1: Navigated to home page');
  await page.screenshot({ path: '/tmp/01_home_page.png', fullPage: true });

  // Click on "View Inventory" button
  console.log('Step 2: Clicking View Inventory...');
  const viewInventoryButton = page.getByRole('button', { name: /view inventory|browse/i });
  await expect(viewInventoryButton).toBeVisible({ timeout: 5000 });
  await viewInventoryButton.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/02_inventory_page.png', fullPage: true });

  // Look for Import button (it should be in the filters bar)
  console.log('Step 3: Looking for Import button...');
  const importButton = page.getByRole('button', { name: /import/i }).first();

  await expect(importButton).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: '/tmp/03_before_click_import.png', fullPage: true });

  // Click Import button
  console.log('Step 4: Clicking Import button...');
  await importButton.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/04_import_dialog_opened.png', fullPage: true });

  // Verify dialog is open
  const dialogTitle = page.getByRole('heading', { name: /import/i });
  await expect(dialogTitle).toBeVisible();
  console.log('Import dialog opened successfully');

  // Find file input and upload
  console.log('Step 5: Uploading xlsx file...');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(process.cwd(), 'public/magazin.xlsx'));
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/05_file_selected.png', fullPage: true });

  // Look for the import confirm button (should appear after file is processed)
  console.log('Step 6: Waiting for preview and clicking import...');
  const importConfirmButton = page.getByRole('button', { name: /import.*product/i });
  
  await expect(importConfirmButton).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: '/tmp/06_preview_ready.png', fullPage: true });
  
  // Log the button text for debugging
  const buttonText = await importConfirmButton.textContent();
  console.log(`Import button text: "${buttonText}"`);
  
  await importConfirmButton.click();
  console.log('Clicked import confirm button');

  // Wait for import to complete (this might take a while)
  console.log('Step 7: Waiting for import to complete...');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: '/tmp/07_import_in_progress.png', fullPage: true });

  // Look for completion message or done button
  const doneButton = page.getByRole('button', { name: /done/i });
  await expect(doneButton).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: '/tmp/08_import_complete.png', fullPage: true });
  
  await doneButton.click();
  await page.waitForTimeout(2000);

  // Verify products appear in list
  console.log('Step 8: Verifying products in list...');
  await page.screenshot({ path: '/tmp/09_products_after_import.png', fullPage: true });

  // Count products in the table or list
  const productRows = page.locator('table tbody tr, .product-card, [class*="ProductListItem"]');
  const count = await productRows.count();
  
  console.log(`\n=== Test Summary ===`);
  console.log(`Products found in list: ${count}`);
  console.log('All screenshots saved to /tmp/');
  
  // Verify at least some products were imported
  expect(count).toBeGreaterThan(0);
});
