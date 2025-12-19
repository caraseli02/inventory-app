const { chromium } = require('playwright');

async function properNavigationTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('1. Loading homepage...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/10-homepage-proper.png', 
      fullPage: true 
    });

    console.log('2. Clicking View Inventory card...');
    // Click the "View Inventory" card
    await page.locator('h2:has-text("View Inventory")').click();
    await page.waitForTimeout(3000); // Wait for view to change and load

    console.log('3. Taking screenshot of inventory page...');
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/11-inventory-proper.png', 
      fullPage: true 
    });

    // Check for Import Invoice button
    const invoiceButton = await page.locator('button:has-text("Import Invoice")').count();
    console.log('Import Invoice button found:', invoiceButton > 0);

    // Get all buttons
    const allButtons = await page.locator('button').all();
    const buttonTexts = [];
    for (const btn of allButtons) {
      try {
        const text = await btn.innerText();
        const visible = await btn.isVisible();
        if (visible && text.trim()) {
          buttonTexts.push(text.trim());
        }
      } catch (e) {
        // Skip
      }
    }

    console.log('All visible buttons:', buttonTexts);

    if (invoiceButton > 0) {
      console.log('4. Clicking Import Invoice button...');
      await page.locator('button:has-text("Import Invoice")').first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ 
        path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/12-invoice-dialog.png', 
        fullPage: true 
      });

      const dialogVisible = await page.locator('[role="dialog"]').isVisible();
      console.log('Invoice dialog visible:', dialogVisible);
    }

    // Wait to view
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

properNavigationTest().catch(console.error);
