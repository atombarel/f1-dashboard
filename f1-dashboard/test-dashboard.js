const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the dashboard
  await page.goto('http://localhost:5174');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ 
    path: 'f1-dashboard-redesign.png', 
    fullPage: true 
  });
  
  console.log('Screenshot saved as f1-dashboard-redesign.png');
  
  await browser.close();
})();