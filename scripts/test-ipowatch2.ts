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
    
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const texts = await rows[i].locator('td').allInnerTexts();
      if (texts.length !== 9) {
          if (count < 5) console.log('Row length:', texts.length, 'Texts:', texts);
          count++;
      }
    }
    console.log(`Total rows not 9 columns: ${count}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testIPOWatch();
