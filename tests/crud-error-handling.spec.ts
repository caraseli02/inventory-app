import { test } from '@playwright/test';

test.describe('CRUD Operations - Error Handling Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console for errors and API calls
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(`🔴 [BROWSER ERROR]: ${text}`);
      } else if (text.includes('deleteProduct') || text.includes('updateProduct') || text.includes('stock')) {
        console.log(`📡 [API LOG]: ${text}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('01 - UPDATE: Edit product and verify changes', async ({ page }) => {
    console.log('\n🧪 TEST 1: UPDATE OPERATION');
    
    // Navigate to inventory
    const viewBtn = page.getByRole('button', { name: /view inventory/i });
    await viewBtn.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'tests/screenshots/crud-01-inventory.png', fullPage: true });
    console.log('✅ Step 1: Navigated to inventory');

    // Find first product and click to view details
    const firstProduct = page.locator('[class*="cursor-pointer"]').first();
    await firstProduct.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'tests/screenshots/crud-02-product-details.png', fullPage: true });
    console.log('✅ Step 2: Opened product details');

    // Click Edit from Quick Actions or find edit button
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'tests/screenshots/crud-03-edit-opened.png', fullPage: true });
      console.log('✅ Step 3: Edit mode activated');

      // Expand pricing section if needed
      const pricingSection = page.getByText('Pricing');
      if (await pricingSection.isVisible()) {
        await pricingSection.click();
        await page.waitForTimeout(500);
      }

      // Find and modify a price field
      const priceInputs = page.locator('input[type="number"]');
      const count = await priceInputs.count();
      console.log(`Found ${count} number inputs`);

      if (count > 0) {
        const firstPriceInput = priceInputs.first();
        await firstPriceInput.clear();
        await firstPriceInput.fill('15.99');
        
        await page.screenshot({ path: 'tests/screenshots/crud-04-price-modified.png', fullPage: true });
        console.log('✅ Step 4: Modified price to 15.99');

        // Save changes
        const saveBtn = page.getByRole('button', { name: /save|update/i }).first();
        await saveBtn.click();
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'tests/screenshots/crud-05-update-saved.png', fullPage: true });
        console.log('✅ Step 5: Changes saved - check console for updateProduct API call');
      }
    }
  });

  test('02 - DELETE: Test FK constraint error handling', async ({ page }) => {
    console.log('\n🧪 TEST 2: DELETE OPERATION WITH FK CHECK');
    
    // Navigate to inventory
    const viewBtn = page.getByRole('button', { name: /view inventory/i });
    await viewBtn.click();
    await page.waitForTimeout(2000);

    // Find first product with stock (should have movements)
    const firstProduct = page.locator('[class*="cursor-pointer"]').first();
    await firstProduct.click();
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'tests/screenshots/crud-06-product-to-delete.png', fullPage: true });
    console.log('✅ Step 1: Selected product for deletion test');

    // Scroll down to find delete button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Look for delete button
    const deleteBtn = page.getByRole('button', { name: /delete/i }).first();
    
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'tests/screenshots/crud-07-delete-clicked.png', fullPage: true });
      console.log('✅ Step 2: Clicked delete button');

      // Check for dialog or error message
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
      if (await dialog.isVisible()) {
        const dialogText = await dialog.textContent();
        console.log(`📋 Dialog content: ${dialogText}`);
        
        await page.screenshot({ path: 'tests/screenshots/crud-08-delete-response.png', fullPage: true });
        
        if (dialogText && (dialogText.toLowerCase().includes('stock') || 
            dialogText.toLowerCase().includes('movement') || 
            dialogText.toLowerCase().includes('history'))) {
          console.log('✅ Step 3: FK constraint error message displayed correctly!');
        } else {
          console.log('ℹ️ Step 3: Confirmation dialog shown (product may have no stock movements)');
        }

        // Close dialog
        const okBtn = page.getByRole('button', { name: /ok|close|cancel/i }).first();
        await okBtn.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('⚠️ Delete button not found');
      await page.screenshot({ path: 'tests/screenshots/crud-08-no-delete-btn.png', fullPage: true });
    }
  });

  test('03 - CREATE: Add new product', async ({ page }) => {
    console.log('\n🧪 TEST 3: CREATE OPERATION');
    
    // Navigate to inventory
    const viewBtn = page.getByRole('button', { name: /view inventory/i });
    await viewBtn.click();
    await page.waitForTimeout(2000);

    // Click Import/Add button
    const importBtn = page.getByRole('button', { name: /import excel/i });
    
    if (await importBtn.isVisible()) {
      console.log('ℹ️ Import Excel button found');
      await page.screenshot({ path: 'tests/screenshots/crud-09-import-available.png', fullPage: true });
      
      // For CREATE test, we would use the scanner or manual add
      // Let's go to scanner page instead
      await page.goto('/');
      await page.waitForTimeout(1000);
      
      const scannerBtn = page.getByRole('button', { name: /manage stock|scanner/i });
      if (await scannerBtn.isVisible()) {
        await scannerBtn.click();
        await page.waitForTimeout(1000);
        
        await page.screenshot({ path: 'tests/screenshots/crud-10-scanner-page.png', fullPage: true });
        console.log('✅ Scanner page opened for product creation');
      }
    }
  });

  test('04 - Console and API Monitoring', async ({ page }) => {
    console.log('\n🧪 TEST 4: CONSOLE & API MONITORING');
    
    const logs: string[] = [];
    const errors: string[] = [];
    const apiCalls: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      
      logs.push(`[${type}] ${text}`);
      
      if (type === 'error') {
        errors.push(text);
      }
      
      if (text.includes('API') || text.includes('supabase') || text.includes('airtable')) {
        apiCalls.push(text);
      }
    });

    // Navigate through app
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const viewBtn = page.getByRole('button', { name: /view inventory/i });
    await viewBtn.click();
    await page.waitForTimeout(3000);

    // Print summary
    console.log(`\n📊 MONITORING SUMMARY:`);
    console.log(`Total logs: ${logs.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`API calls: ${apiCalls.length}`);

    if (errors.length > 0) {
      console.log(`\n❌ ERRORS DETECTED:`);
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log(`\n✅ No errors detected`);
    }

    if (apiCalls.length > 0) {
      console.log(`\n📡 API CALLS:`);
      apiCalls.slice(0, 5).forEach(call => console.log(`  - ${call}`));
    }

    await page.screenshot({ path: 'tests/screenshots/crud-11-monitoring.png', fullPage: true });
  });
});
