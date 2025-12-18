const { chromium } = require('playwright');

async function runVisualTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {
    test_run: "Invoice OCR Visual Review",
    timestamp: new Date().toISOString(),
    tests: [],
    console_logs: [],
    errors: []
  };

  page.on('console', msg => {
    const logType = msg.type();
    const logText = msg.text();
    results.console_logs.push(logType + ': ' + logText);
  });
  
  page.on('pageerror', err => {
    results.errors.push(err.toString());
  });

  try {
    console.log('Test 1: Homepage/Scanner Page...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/01-homepage-initial.png', 
      fullPage: true 
    });
    
    const homeTest = {
      name: 'Homepage/Scanner',
      url: 'http://localhost:5173',
      title: await page.title(),
      buttons: await page.locator('button').count(),
      navigation: await page.locator('nav').count() > 0,
      viewport: await page.viewportSize()
    };
    results.tests.push(homeTest);
    console.log('Homepage screenshot captured');

    console.log('Test 2: Inventory Page...');
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/02-inventory-page.png', 
      fullPage: true 
    });
    
    const inventoryTest = {
      name: 'Inventory Page',
      url: 'http://localhost:5173/inventory',
      title: await page.title(),
      buttons: await page.locator('button').count(),
      cards: await page.locator('[class*="card"]').count()
    };
    results.tests.push(inventoryTest);
    console.log('Inventory page screenshot captured');

    console.log('Test 3: Looking for Invoice/Import functionality...');
    const importButtons = await page.locator('button:has-text("Import"), button:has-text("Invoice"), button:has-text("Upload")').all();
    const invoiceTest = {
      name: 'Invoice Import Feature',
      import_button_found: importButtons.length > 0,
      button_count: importButtons.length,
      button_texts: []
    };
    
    if (importButtons.length > 0) {
      for (const btn of importButtons) {
        const text = await btn.innerText();
        invoiceTest.button_texts.push(text);
        console.log('Found button: ' + text);
      }
      
      try {
        await importButtons[0].click();
        await page.waitForTimeout(1500);
        await page.screenshot({ 
          path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/03-invoice-dialog.png', 
          fullPage: true 
        });
        invoiceTest.dialog_opened = true;
        console.log('Invoice dialog screenshot captured');
      } catch (e) {
        invoiceTest.dialog_error = e.message;
        console.log('Could not open dialog: ' + e.message);
      }
    } else {
      console.log('No import/invoice buttons found');
    }
    results.tests.push(invoiceTest);

    console.log('Test 4: Mobile Responsiveness...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/04-mobile-homepage.png', 
      fullPage: true 
    });
    console.log('Mobile homepage screenshot captured');

    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/05-mobile-inventory.png', 
      fullPage: true 
    });
    console.log('Mobile inventory screenshot captured');

    const mobileTest = {
      name: 'Mobile Responsiveness',
      viewport: { width: 375, height: 667 },
      pages_tested: ['homepage', 'inventory']
    };
    results.tests.push(mobileTest);

    console.log('Test 5: Checking for language selector...');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:5173/inventory', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    
    const langSelector = await page.locator('[class*="language"], [id*="language"], select:has-text("EN"), select:has-text("RO")').count();
    const langTest = {
      name: 'Language Selector',
      selector_found: langSelector > 0,
      selector_count: langSelector
    };
    results.tests.push(langTest);
    console.log(langSelector > 0 ? 'Language selector found' : 'Language selector not found');

  } catch (error) {
    console.error('Test error:', error);
    results.fatal_error = error.message;
  } finally {
    await browser.close();
  }

  const fs = require('fs');
  fs.writeFileSync(
    '/Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/test-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\nTest Summary:');
  console.log('Total tests: ' + results.tests.length);
  console.log('Console logs: ' + results.console_logs.length);
  console.log('Errors: ' + results.errors.length);
  console.log('\nVisual testing complete!');
  console.log('Screenshots: /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/');
  console.log('Results: /Users/vladislavcaraseli/Documents/inventory-app/test-screenshots/test-results.json');
  
  return results;
}

runVisualTests().catch(console.error);
