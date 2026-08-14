import { chromium } from 'playwright';

async function testIPOWatch() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing IPO Watch...');
    await page.goto('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', { waitUntil: 'domcontentloaded' });
    const rows = await page.locator('figure.wp-block-table table tbody tr').all();
    console.log(`Found ${rows.length} rows.`);
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const texts = await rows[i].locator('td').allInnerTexts();
      console.log('Row:', texts);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testIPOWatch();
