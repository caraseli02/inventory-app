const { chromium } = require('playwright');

async function inspectDOM() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(5000); // Wait longer for React to render

    // Get the entire page HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/page-html.html', html);
    
    console.log('Page HTML saved to page-html.html');

    // Check for specific elements
    const hasFiltersBar = await page.locator('[class*="DesktopFilterBar"], [class*="desktop-filter"]').count();
    const hasHiddenClass = await page.locator('.hidden.md\\:block').count();
    const importButtons = await page.locator('button').all();
    
    console.log('Has filters bar div:', hasFiltersBar);
    console.log('Has hidden md:block class:', hasHiddenClass);
    console.log('Total buttons:', importButtons.length);

    // Get all text content
    const bodyText = await page.textContent('body');
    console.log('Page contains "Import":', bodyText.includes('Import'));
    console.log('Page contains "Invoice":', bodyText.includes('Invoice'));
    console.log('Page contains "Excel":', bodyText.includes('Excel'));

    // Take a screenshot
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/09-dom-inspection.png', 
      fullPage: true 
    });

    // Wait to see the page
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

inspectDOM().catch(console.error);
