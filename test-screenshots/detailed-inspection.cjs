const { chromium } = require('playwright');

async function detailedInspection() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const report = {
    timestamp: new Date().toISOString(),
    pages_inspected: []
  };

  try {
    console.log('Detailed Inspection: Inventory Page Elements...');
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);

    const inventoryReport = {
      page: 'Inventory',
      url: 'http://localhost:5173/inventory',
      elements: {}
    };

    // Count all interactive elements
    inventoryReport.elements.all_buttons = await page.locator('button').count();
    inventoryReport.elements.all_links = await page.locator('a').count();
    inventoryReport.elements.all_inputs = await page.locator('input').count();
    inventoryReport.elements.all_selects = await page.locator('select').count();
    
    // Get button texts
    const buttons = await page.locator('button').all();
    inventoryReport.button_details = [];
    for (const btn of buttons) {
      try {
        const text = await btn.innerText();
        const visible = await btn.isVisible();
        const classes = await btn.getAttribute('class');
        inventoryReport.button_details.push({
          text: text.trim(),
          visible: visible,
          classes: classes
        });
      } catch (e) {
        // Skip if element is not accessible
      }
    }

    // Check for specific text on page
    const pageText = await page.textContent('body');
    inventoryReport.contains_import = pageText.toLowerCase().includes('import');
    inventoryReport.contains_invoice = pageText.toLowerCase().includes('invoice');
    inventoryReport.contains_upload = pageText.toLowerCase().includes('upload');
    inventoryReport.contains_excel = pageText.toLowerCase().includes('excel');
    inventoryReport.contains_xlsx = pageText.toLowerCase().includes('xlsx');

    // Check for file inputs (upload)
    inventoryReport.file_inputs = await page.locator('input[type="file"]').count();

    // Check navigation/routing
    const links = await page.locator('a').all();
    inventoryReport.navigation_links = [];
    for (const link of links) {
      try {
        const text = await link.innerText();
        const href = await link.getAttribute('href');
        inventoryReport.navigation_links.push({
          text: text.trim(),
          href: href
        });
      } catch (e) {
        // Skip
      }
    }

    report.pages_inspected.push(inventoryReport);
    console.log('Inventory page inspection complete');

    // Check homepage for scanner features
    console.log('Detailed Inspection: Homepage/Scanner...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);

    const homeReport = {
      page: 'Homepage',
      url: 'http://localhost:5173',
      elements: {}
    };

    homeReport.elements.all_buttons = await page.locator('button').count();
    const homeButtons = await page.locator('button').all();
    homeReport.button_details = [];
    for (const btn of homeButtons) {
      try {
        const text = await btn.innerText();
        const visible = await btn.isVisible();
        const classes = await btn.getAttribute('class');
        homeReport.button_details.push({
          text: text.trim(),
          visible: visible,
          classes: classes
        });
      } catch (e) {
        // Skip
      }
    }

    // Check for scanner element
    homeReport.has_scanner = await page.locator('#reader').count() > 0;
    homeReport.has_video = await page.locator('video').count() > 0;

    const homeText = await page.textContent('body');
    homeReport.page_content_keywords = {
      scan: homeText.toLowerCase().includes('scan'),
      camera: homeText.toLowerCase().includes('camera'),
      barcode: homeText.toLowerCase().includes('barcode')
    };

    report.pages_inspected.push(homeReport);
    console.log('Homepage inspection complete');

    // Take a final annotated screenshot
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/06-detailed-inventory.png', 
      fullPage: true 
    });

  } catch (error) {
    console.error('Inspection error:', error);
    report.error = error.message;
  } finally {
    await browser.close();
  }

  const fs = require('fs');
  fs.writeFileSync(
    '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/detailed-inspection.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\nDetailed Inspection Results:');
  console.log('Results saved to: /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/detailed-inspection.json');
  
  return report;
}

detailedInspection().catch(console.error);
