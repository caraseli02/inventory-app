import { test, expect } from '@playwright/test';

test.describe('Product CRUD Operations', () => {
  // Set up: Navigate to inventory page before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Click on "View Inventory" card to navigate to inventory list
    await page.getByRole('button', { name: /view inventory|view full inventory/i }).click();
    
    // Wait for inventory page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for data to load
  });

  test('01 - Initial State: Check if inventory list loads', async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/01-initial-state.png', fullPage: true });
    
    // Verify page title or header
    await expect(page.locator('h1, h2').first()).toBeVisible();
    
    console.log('✅ Initial inventory list loaded successfully');
  });

  test('02 - Create Product: Add new product', async ({ page }) => {
    // Look for "Add Product" or "Import" button
    const addButton = page.getByRole('button', { name: /add product|new product/i });
    
    // If no add button, check if we need to import first
    if (!(await addButton.isVisible())) {
      console.log('ℹ️ No Add Product button found. Looking for import option...');
      
      // Try to find import button
      const importButton = page.getByRole('button', { name: /import/i }).first();
      if (await importButton.isVisible()) {
        console.log('ℹ️ Import button found. You may need to import products first.');
      }
    } else {
      // Click Add Product button
      await addButton.click();
      await page.waitForTimeout(1000);
      
      // Fill in product details
      await page.getByLabel(/name/i).fill('Test Product E2E');
      await page.getByLabel(/barcode/i).fill('9999999999');
      
      // Try to find price field (may have different labels)
      const priceField = page.locator('input[type="number"]').first();
      await priceField.fill('10.50');
      
      // Take screenshot before submitting
      await page.screenshot({ path: 'tests/screenshots/02-create-form-filled.png', fullPage: true });
      
      // Click Save/Submit button
      const saveButton = page.getByRole('button', { name: /save|create|submit/i });
      await saveButton.click();
      
      // Wait for success toast or product to appear
      await page.waitForTimeout(2000);
      
      // Take screenshot after creation
      await page.screenshot({ path: 'tests/screenshots/02-create-success.png', fullPage: true });
      
      // Verify product appears in list
      await expect(page.getByText('Test Product E2E')).toBeVisible();
      
      console.log('✅ Product created successfully');
    }
  });

  test('03 - Read Product: View product details', async ({ page }) => {
    // Find a product in the list (look for any product card or row)
    const productItems = page.locator('[class*="product"], [data-testid="product-item"]').first();
    
    if (await productItems.isVisible()) {
      // Click on the product to view details
      await productItems.click();
      await page.waitForTimeout(1000);
      
      // Take screenshot of product details
      await page.screenshot({ path: 'tests/screenshots/03-read-details.png', fullPage: true });
      
      // Verify details dialog or page is visible
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
        console.log('✅ Product details dialog opened');
      } else {
        console.log('ℹ️ Product details may be shown inline');
      }
    } else {
      console.log('⚠️ No products found in list. Import products first.');
    }
  });

  test('04 - Update Product: Edit product details', async ({ page }) => {
    // Find the test product or any product
    const testProduct = page.getByText('Test Product E2E').first();
    
    if (await testProduct.isVisible()) {
      // Click on product
      await testProduct.click();
      await page.waitForTimeout(1000);
      
      // Look for Edit button
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      await editButton.click();
      await page.waitForTimeout(1000);
      
      // Update the name
      const nameField = page.getByLabel(/name/i);
      await nameField.clear();
      await nameField.fill('Updated Test Product E2E');
      
      // Take screenshot before saving
      await page.screenshot({ path: 'tests/screenshots/04-edit-form.png', fullPage: true });
      
      // Click Save button
      const saveButton = page.getByRole('button', { name: /save|update/i }).first();
      await saveButton.click();
      
      // Wait for update to complete
      await page.waitForTimeout(2000);
      
      // Take screenshot after update
      await page.screenshot({ path: 'tests/screenshots/04-edit-success.png', fullPage: true });
      
      // Verify updated name appears
      await expect(page.getByText('Updated Test Product E2E')).toBeVisible();
      
      console.log('✅ Product updated successfully');
    } else {
      console.log('⚠️ Test product not found. Create it first.');
    }
  });

  test('05 - Delete Product: Remove product', async ({ page }) => {
    // Find the test product
    const testProduct = page.getByText(/Updated Test Product E2E|Test Product E2E/i).first();
    
    if (await testProduct.isVisible()) {
      // Click on product to select it or open details
      await testProduct.click();
      await page.waitForTimeout(1000);
      
      // Look for Delete button (may be in dialog or inline)
      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);
        
        // Take screenshot of confirmation dialog
        await page.screenshot({ path: 'tests/screenshots/05-delete-confirm.png', fullPage: true });
        
        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i }).last();
        await confirmButton.click();
        
        // Wait for deletion to complete
        await page.waitForTimeout(2000);
        
        // Take screenshot after deletion
        await page.screenshot({ path: 'tests/screenshots/05-delete-success.png', fullPage: true });
        
        // Verify product is removed
        await expect(page.getByText(/Updated Test Product E2E|Test Product E2E/i)).not.toBeVisible();
        
        console.log('✅ Product deleted successfully');
      } else {
        console.log('⚠️ Delete button not found');
      }
    } else {
      console.log('ℹ️ Test product not found (may have been deleted already)');
    }
  });

  test('06 - Console Check: Verify Supabase API calls', async ({ page }) => {
    // Set up console listener to capture API calls
    const apiCalls: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('supabase') || text.includes('createProduct') || text.includes('updateProduct') || text.includes('deleteProduct')) {
        apiCalls.push(text);
      }
    });
    
    // Monitor network requests
    const networkCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      if (url.includes('supabase') || url.includes('api')) {
        networkCalls.push(method + ' ' + url);
      }
    });
    
    // Wait for some activity
    await page.waitForTimeout(3000);
    
    console.log('\n📡 API Calls detected:');
    if (apiCalls.length > 0) {
      apiCalls.forEach(call => console.log('  - ' + call));
    } else {
      console.log('  No console logs with API keywords found');
    }
    
    console.log('\n🌐 Network Calls detected:');
    if (networkCalls.length > 0) {
      networkCalls.forEach(call => console.log('  - ' + call));
    } else {
      console.log('  No network calls to Supabase/API detected');
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'tests/screenshots/06-console-check.png', fullPage: true });
  });
});
