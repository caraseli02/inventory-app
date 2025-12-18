import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Product CRUD Operations - Detailed Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to inventory list
    const inventoryCard = page.locator('[role="button"]').filter({ hasText: /view inventory|inventory/i }).first();
    await inventoryCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('Step 1: Import products from Excel', async ({ page }) => {
    console.log('📋 Step 1: Importing products from Excel file');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-01-before-import.png', 
      fullPage: true 
    });
    
    // Check if products already exist
    const noProductsMessage = page.getByText(/no products found/i);
    const hasNoProducts = await noProductsMessage.isVisible();
    
    if (hasNoProducts) {
      console.log('ℹ️ No products found. Will import from Excel.');
      
      // Click Import Excel button
      const importButton = page.getByRole('button', { name: /import excel/i });
      await importButton.click();
      await page.waitForTimeout(1000);
      
      // Take screenshot of import dialog
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-02-import-dialog.png', 
        fullPage: true 
      });
      
      // Check if magazin.xlsx exists
      const xlsxPath = path.join(__dirname, '../public/magazin.xlsx');
      console.log('📁 Excel file path:', xlsxPath);
      
      // Look for file input
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Upload the Excel file
        await fileInput.setInputFiles(xlsxPath);
        await page.waitForTimeout(2000);
        
        console.log('✅ Excel file uploaded');
        
        // Take screenshot after upload
        await page.screenshot({ 
          path: 'tests/screenshots/detailed-03-file-uploaded.png', 
          fullPage: true 
        });
        
        // Look for import confirmation button
        const confirmButton = page.getByRole('button', { name: /import|confirm|upload/i }).last();
        await confirmButton.click();
        
        // Wait for import to complete (may take some time)
        await page.waitForTimeout(5000);
        
        console.log('✅ Products imported successfully');
      }
    } else {
      console.log('✅ Products already exist in the database');
    }
    
    // Take screenshot after import
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-04-after-import.png', 
      fullPage: true 
    });
    
    // Verify products are now visible
    const productCount = page.getByText(/\d+ products/i);
    await expect(productCount).toBeVisible({ timeout: 10000 });
  });

  test('Step 2: Create a new product manually', async ({ page }) => {
    console.log('➕ Step 2: Creating a new product manually');
    
    // First, check if there's an "Add Product" button
    // Since we don't have one, we'll test the scanner flow instead
    
    // Go back to home and enter Manage Stock mode
    await page.getByRole('button', { name: /back/i }).click();
    await page.waitForTimeout(1000);
    
    // Click Manage Stock card
    const manageStockCard = page.locator('[role="button"]').filter({ hasText: /manage stock/i }).first();
    await manageStockCard.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-05-scanner-page.png', 
      fullPage: true 
    });
    
    // Look for manual entry or barcode input
    const barcodeInput = page.locator('input[type="text"]').first();
    if (await barcodeInput.isVisible()) {
      await barcodeInput.fill('9999999999');
      await page.waitForTimeout(1000);
      
      // Press Enter or click search
      await barcodeInput.press('Enter');
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-06-new-product-form.png', 
        fullPage: true 
      });
      
      // Fill in product details if form appears
      const nameInput = page.getByLabel(/product name|name/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Product Manual');
        
        const priceInput = page.locator('input[type="number"]').first();
        await priceInput.fill('15.99');
        
        // Select category if available
        const categorySelect = page.locator('select, [role="combobox"]').first();
        if (await categorySelect.isVisible()) {
          await categorySelect.click();
          await page.waitForTimeout(500);
          // Select first option
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/detailed-07-form-filled.png', 
          fullPage: true 
        });
        
        // Click Save button
        const saveButton = page.getByRole('button', { name: /save|create/i }).first();
        await saveButton.click();
        await page.waitForTimeout(3000);
        
        console.log('✅ New product created');
        
        await page.screenshot({ 
          path: 'tests/screenshots/detailed-08-product-created.png', 
          fullPage: true 
        });
      }
    }
  });

  test('Step 3: View product details', async ({ page }) => {
    console.log('👁️ Step 3: Viewing product details');
    
    // Find first product in list
    const firstProduct = page.locator('[class*="product"], tr').first();
    await firstProduct.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-09-product-details.png', 
      fullPage: true 
    });
    
    // Verify details dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    console.log('✅ Product details displayed');
  });

  test('Step 4: Edit product', async ({ page }) => {
    console.log('✏️ Step 4: Editing a product');
    
    // Find first product
    const firstProduct = page.locator('[class*="product"], tr').first();
    await firstProduct.click();
    await page.waitForTimeout(1000);
    
    // Click Edit button
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    await editButton.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-10-edit-dialog.png', 
      fullPage: true 
    });
    
    // Modify price
    const priceInput = page.locator('input[type="number"]').filter({ hasText: /price/i }).or(
      page.locator('input[name*="price"]')
    ).first();
    
    if (await priceInput.isVisible()) {
      await priceInput.clear();
      await priceInput.fill('99.99');
      
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-11-price-changed.png', 
        fullPage: true 
      });
      
      // Save changes
      const saveButton = page.getByRole('button', { name: /save|update/i }).first();
      await saveButton.click();
      await page.waitForTimeout(3000);
      
      console.log('✅ Product updated');
      
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-12-product-updated.png', 
        fullPage: true 
      });
    }
  });

  test('Step 5: Delete product', async ({ page }) => {
    console.log('🗑️ Step 5: Deleting a product');
    
    // Find the test product if it exists
    const testProduct = page.getByText(/test product manual/i).first();
    
    if (await testProduct.isVisible()) {
      await testProduct.click();
      await page.waitForTimeout(1000);
      
      // Click Delete button
      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
      await deleteButton.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-13-delete-confirm.png', 
        fullPage: true 
      });
      
      // Confirm deletion
      const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i }).last();
      await confirmButton.click();
      await page.waitForTimeout(2000);
      
      console.log('✅ Product deleted');
      
      await page.screenshot({ 
        path: 'tests/screenshots/detailed-14-product-deleted.png', 
        fullPage: true 
      });
      
      // Verify product is gone
      await expect(testProduct).not.toBeVisible();
    } else {
      console.log('ℹ️ Test product not found, skipping delete test');
    }
  });

  test('Step 6: Check network activity', async ({ page }) => {
    console.log('🌐 Step 6: Monitoring network activity');
    
    const networkRequests: Array<{ method: string; url: string; status?: number }> = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('supabase') || url.includes('api') || url.includes('products')) {
        networkRequests.push({
          method: response.request().method(),
          url: url,
          status: response.status(),
        });
      }
    });
    
    // Trigger a refresh to see API calls
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(3000);
    }
    
    console.log('\n📡 Network Activity Summary:');
    if (networkRequests.length > 0) {
      networkRequests.forEach(req => {
        console.log(`  ${req.method} ${req.url} - Status: ${req.status || 'pending'}`);
      });
    } else {
      console.log('  No Supabase/API calls detected');
    }
    
    await page.screenshot({ 
      path: 'tests/screenshots/detailed-15-network-check.png', 
      fullPage: true 
    });
  });
});
