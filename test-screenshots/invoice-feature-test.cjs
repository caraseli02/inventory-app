const { chromium } = require('playwright');

async function testInvoiceFeature() {
  const browser = await chromium.launch({ headless: false }); // non-headless to see what's happening
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const report = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    console.log('Testing Invoice Feature...');
    
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/07-inventory-desktop-full.png', 
      fullPage: true 
    });

    // Look for the Import Invoice button specifically
    const invoiceButton = page.locator('button:has-text("Import Invoice")');
    const buttonCount = await invoiceButton.count();
    
    report.tests.push({
      name: 'Invoice Button Visibility',
      button_found: buttonCount > 0,
      button_count: buttonCount,
      viewport: { width: 1440, height: 900 }
    });

    console.log('Import Invoice button found:', buttonCount > 0);

    if (buttonCount > 0) {
      console.log('Clicking Import Invoice button...');
      await invoiceButton.click();
      await page.waitForTimeout(2000);

      // Take screenshot of dialog
      await page.screenshot({ 
        path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/08-invoice-dialog-open.png', 
        fullPage: true 
      });

      // Check dialog contents
      const dialogVisible = await page.locator('[role="dialog"]').isVisible();
      const fileInput = await page.locator('input[type="file"]').count();
      const dialogText = await page.textContent('body');

      report.tests.push({
        name: 'Invoice Dialog',
        dialog_visible: dialogVisible,
        has_file_input: fileInput > 0,
        contains_ocr: dialogText.toLowerCase().includes('ocr'),
        contains_pdf: dialogText.toLowerCase().includes('pdf'),
        contains_image: dialogText.toLowerCase().includes('image')
      });

      console.log('Dialog visible:', dialogVisible);
      console.log('File input found:', fileInput > 0);
    }

    // Test all action buttons
    const allButtons = await page.locator('button').all();
    const buttonTexts = [];
    for (const btn of allButtons) {
      try {
        const text = await btn.innerText();
        const visible = await btn.isVisible();
        if (visible) {
          buttonTexts.push(text.trim());
        }
      } catch (e) {
        // Skip
      }
    }

    report.tests.push({
      name: 'All Visible Buttons',
      buttons: buttonTexts
    });

    console.log('All visible buttons:', buttonTexts);

  } catch (error) {
    console.error('Test error:', error);
    report.error = error.message;
  } finally {
    await browser.close();
  }

  const fs = require('fs');
  fs.writeFileSync(
    '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/invoice-feature-test.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\nInvoice Feature Test Complete!');
  console.log('Results: /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/invoice-feature-test.json');
  
  return report;
}

testInvoiceFeature().catch(console.error);
