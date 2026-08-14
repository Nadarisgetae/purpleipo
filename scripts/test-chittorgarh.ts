import { chromium } from 'playwright';

async function testChittorgarh() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  try {
    console.log('Testing Mainboard...');
    const page = await context.newPage();
    await page.goto('https://www.chittorgarh.com/report/mainboard-ipo-list-in-india/29/', { waitUntil: 'domcontentloaded' });
    
    // Chittorgarh uses Bootstrap tables
    const rows = await page.locator('table.table-bordered tbody tr').all();
    console.log(`Found ${rows.length} rows in Mainboard.`);
    
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const texts = await rows[i].locator('td').allInnerTexts();
      console.log('Row:', texts);
    }
    await page.close();

    console.log('\nTesting SME...');
    const page2 = await context.newPage();
    await page2.goto('https://www.chittorgarh.com/report/sme-ipo-list-in-india/27/', { waitUntil: 'domcontentloaded' });
    
    const rows2 = await page2.locator('table.table-bordered tbody tr').all();
    console.log(`Found ${rows2.length} rows in SME.`);
    
    for (let i = 0; i < Math.min(3, rows2.length); i++) {
      const texts = await rows2[i].locator('td').allInnerTexts();
      console.log('Row:', texts);
    }
    await page2.close();

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testChittorgarh().catch(console.error);
