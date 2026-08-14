import { chromium } from 'playwright';

async function testSub() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing IPO Subscription...');
    await page.goto('https://ipowatch.in/ipo-subscription-status-today/', { waitUntil: 'domcontentloaded' });
    const rows = await page.locator('table tbody tr').all();
    console.log(`Found ${rows.length} rows.`);
    
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const texts = await rows[i].locator('td').allInnerTexts();
      console.log(`Row ${i}:`, texts.map(t => t.trim()));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testSub();
