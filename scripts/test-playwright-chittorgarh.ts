import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function testPlaywrightChittorgarh() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Chittorgarh...');
    await page.goto('https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('Page loaded. Checking title:', await page.title());
    
    // Wait for the dynamic table to load
    console.log('Waiting for table to load...');
    try {
      await page.waitForSelector('table', { timeout: 15000 });
      console.log('Table selector found!');
    } catch (e) {
      console.log('Table selector timed out. Checking current HTML body text:');
    }
    
    const rows: any[] = [];
    const trsCount = await page.locator('table tbody tr').count();
    console.log('Total rows in tbody:', trsCount);

    for (let i = 0; i < Math.min(5, trsCount); i++) {
      const rowLocator = page.locator('table tbody tr').nth(i);
      const tdsCount = await rowLocator.locator('td').count();
      if (tdsCount >= 10) {
        const companyCell = rowLocator.locator('td').nth(0);
        const company = await companyCell.innerText();
        let href = '';
        try {
          href = await companyCell.locator('a').getAttribute('href') || '';
        } catch (e) {}

        const openDate = await rowLocator.locator('td').nth(2).innerText();
        const closeDate = await rowLocator.locator('td').nth(3).innerText();
        const listingDate = await rowLocator.locator('td').nth(4).innerText();
        const issuePrice = await rowLocator.locator('td').nth(5).innerText();
        const totalAmount = await rowLocator.locator('td').nth(6).innerText();
        const freshAmt = await rowLocator.locator('td').nth(7).innerText();
        const ofsAmt = await rowLocator.locator('td').nth(8).innerText();
        
        rows.push({
          company: company.trim(),
          href: href.trim(),
          openDate: openDate.trim(),
          closeDate: closeDate.trim(),
          listingDate: listingDate.trim(),
          issuePrice: issuePrice.trim(),
          totalAmount: totalAmount.trim(),
          freshAmt: freshAmt.trim(),
          ofsAmt: ofsAmt.trim(),
        });
      }
    }
    console.log('Extracted Rows with links:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testPlaywrightChittorgarh().catch(console.error);
