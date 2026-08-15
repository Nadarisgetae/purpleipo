import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function testPlaywrightDetail() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Let's use one of the live links we just found
    const detailUrl = 'https://www.chittorgarh.com/ipo_subscription/behari-lal-engineering-ipo/2659/';
    console.log('Navigating to subscription page:', detailUrl);
    await page.goto(detailUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('Page loaded. Title:', await page.title());

    // Wait for the dynamic tables to load
    console.log('Waiting for tables to load...');
    await page.waitForSelector('table', { timeout: 15000 });
    console.log('Tables rendered!');

    const html = await page.content();
    const $ = cheerio.load(html);

    const tablesCount = await page.locator('table').count();
    console.log('Tables found:', tablesCount);
    for (let i = 0; i < tablesCount; i++) {
      console.log(`\n--- CONTENTS OF TABLE ${i} ---`);
      const rowLocator = page.locator('table').nth(i).locator('tr');
      const rowsCount = await rowLocator.count();
      for (let j = 0; j < Math.min(10, rowsCount); j++) {
        const cellsText = await rowLocator.nth(j).locator('th, td').allInnerTexts();
        console.log(`  Row ${j}:`, cellsText);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testPlaywrightDetail().catch(console.error);
