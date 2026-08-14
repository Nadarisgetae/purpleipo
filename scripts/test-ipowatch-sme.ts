import { chromium } from 'playwright';

async function testSME() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing SME IPO Watch...');
    await page.goto('https://ipowatch.in/sme-ipo-gmp-live-rates/', { waitUntil: 'domcontentloaded' });
    const rows = await page.locator('table tbody tr').all();
    console.log(`Found ${rows.length} rows.`);
    
    let count = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const texts = await rows[i].locator('td').allInnerTexts();
      console.log('Row length:', texts.length, 'Texts:', texts);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testSME();
