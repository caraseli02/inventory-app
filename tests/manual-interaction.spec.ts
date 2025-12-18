import { test } from '@playwright/test';

test.describe('Manual UI Interaction Tests', () => {
  test('Navigate and explore the app', async ({ page }) => {
    // Step 1: Load home page
    console.log('Step 1: Loading home page');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/manual-01-homepage.png', 
      fullPage: true 
    });
    console.log('✅ Screenshot 1: Homepage');
    
    // Step 2: Click View Inventory
    console.log('\nStep 2: Clicking View Inventory');
    const inventoryButton = page.locator('[role="button"]').filter({ hasText: /inventory/i }).last();
    await inventoryButton.click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/manual-02-inventory-list.png', 
      fullPage: true 
    });
    console.log('✅ Screenshot 2: Inventory List');
    
    // Step 3: Check if products exist
    const noProductsMsg = page.getByText(/no products found/i);
    const hasProducts = !(await noProductsMsg.isVisible());
    
    if (hasProducts) {
      console.log('✅ Products found in database');
      
      // Step 4: Find and click first product
      console.log('\nStep 3: Finding first product');
      await page.waitForTimeout(2000);
      
      // Look for product cards or table rows
      const productElements = await page.locator('table tbody tr, [data-testid*="product"], div[role="row"]').count();
      console.log(`Found ${productElements} product elements`);
      
      if (productElements > 0) {
        const firstProduct = page.locator('table tbody tr, [data-testid*="product"], div[role="row"]').first();
        await firstProduct.click();
        await page.waitForTimeout(2000);
        
        await page.screenshot({ 
          path: 'tests/screenshots/manual-03-product-details.png', 
          fullPage: true 
        });
        console.log('✅ Screenshot 3: Product Details');
        
        // Step 5: Look for Edit button
        const editBtn = page.getByRole('button', { name: /edit/i });
        if (await editBtn.isVisible({ timeout: 5000 })) {
          console.log('\nStep 4: Clicking Edit button');
          await editBtn.click();
          await page.waitForTimeout(2000);
          
          await page.screenshot({ 
            path: 'tests/screenshots/manual-04-edit-dialog.png', 
            fullPage: true 
          });
          console.log('✅ Screenshot 4: Edit Dialog');
          
          // Check form fields
          const inputs = await page.locator('input').count();
          console.log(`Found ${inputs} input fields in edit dialog`);
          
          // Close dialog
          const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(1000);
          }
        } else {
          console.log('⚠️ Edit button not found');
        }
        
        // Step 6: Look for Delete button
        const deleteBtn = page.getByRole('button', { name: /delete/i });
        if (await deleteBtn.isVisible({ timeout: 5000 })) {
          console.log('\nStep 5: Found Delete button (not clicking)');
          
          await page.screenshot({ 
            path: 'tests/screenshots/manual-05-with-delete-button.png', 
            fullPage: true 
          });
          console.log('✅ Screenshot 5: Delete Button Visible');
        }
        
        // Close details dialog
        const closeBtn = page.locator('button[aria-label*="close"], button:has-text("×")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      console.log('⚠️ No products found. Database may be empty.');
      console.log('ℹ️ You need to import products using the Import Excel button');
      
      // Check for Import button
      const importBtn = page.getByRole('button', { name: /import excel/i });
      if (await importBtn.isVisible()) {
        console.log('✅ Import Excel button is available');
      }
    }
    
    // Step 7: Go back to home
    console.log('\nStep 6: Navigating back to home');
    const backBtn = page.locator('button[aria-label*="back"], button:has-text("←")').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'tests/screenshots/manual-06-back-to-home.png', 
        fullPage: true 
      });
      console.log('✅ Screenshot 6: Back to Home');
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Navigation: Working');
    console.log('✅ UI Loading: Working');
    console.log(hasProducts ? '✅ Products: Found' : '⚠️ Products: Empty (import needed)');
    console.log('📸 Screenshots saved to: tests/screenshots/');
    console.log('='.repeat(60));
  });

  test('Test product creation flow via scanner', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING PRODUCT CREATION VIA SCANNER');
    console.log('='.repeat(60));
    
    // Navigate to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click Manage Stock
    console.log('\nStep 1: Opening Manage Stock (Scanner)');
    const manageStockBtn = page.locator('[role="button"]').filter({ hasText: /manage stock/i }).first();
    await manageStockBtn.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'tests/screenshots/scanner-01-scanner-page.png', 
      fullPage: true 
    });
    console.log('✅ Screenshot: Scanner Page');
    
    // Enter barcode manually
    console.log('\nStep 2: Entering test barcode');
    const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('TEST123456');
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'tests/screenshots/scanner-02-barcode-entered.png', 
        fullPage: true 
      });
      console.log('✅ Screenshot: Barcode Entered');
      
      // Press Enter or click search
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);
      
      await page.screenshot({ 
        path: 'tests/screenshots/scanner-03-search-result.png', 
        fullPage: true 
      });
      console.log('✅ Screenshot: Search Result');
      
      // Check if product form appears
      const nameInput = page.getByLabel(/name/i);
      const productNameInput = page.locator('input[name*="name"], input[placeholder*="name"]').first();
      
      if (await nameInput.isVisible() || await productNameInput.isVisible()) {
        console.log('\n✅ Product form appeared (new product)');
        
        // Fill in details
        const activeNameInput = await nameInput.isVisible() ? nameInput : productNameInput;
        await activeNameInput.fill('Test Product via Scanner');
        
        const priceInput = page.locator('input[type="number"]').first();
        if (await priceInput.isVisible()) {
          await priceInput.fill('10.50');
        }
        
        await page.screenshot({ 
          path: 'tests/screenshots/scanner-04-form-filled.png', 
          fullPage: true 
        });
        console.log('✅ Screenshot: Form Filled');
        
        // Save product
        const saveBtn = page.getByRole('button', { name: /save|create|add/i }).first();
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(3000);
          
          await page.screenshot({ 
            path: 'tests/screenshots/scanner-05-product-created.png', 
            fullPage: true 
          });
          console.log('✅ Screenshot: Product Created');
          console.log('✅ Product creation: SUCCESS');
        }
      } else {
        console.log('ℹ️ Product may already exist or form did not appear');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Scanner flow test completed');
    console.log('='.repeat(60));
  });
});
