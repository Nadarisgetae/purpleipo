import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function testAnchorReport() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const url = 'https://www.chittorgarh.com/report/anchor-investors-list/133/mainboard/';
    console.log('Navigating to anchor list:', url);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('table', { timeout: 15000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('Tables found on anchor page:', $('table').length);
    $('table').each((tableIdx, tableEl) => {
      const firstRow: string[] = [];
      $(tableEl).find('tr').first().find('th, td').each((i, el) => {
        firstRow.push($(el).text().trim().replace(/\s+/g, ' '));
      });
      console.log(`Table ${tableIdx}: first row =`, firstRow.slice(0, 5));
    });

    // Let's print the first 5 rows of Table 0
    console.log('\nTable 0 rows:');
    $('table').first().find('tr').slice(0, 10).each((rowIdx, rowEl) => {
      const cells: string[] = [];
      $(rowEl).find('th, td').each((colIdx, colEl) => {
        cells.push($(colEl).text().trim().replace(/\s+/g, ' '));
      });
      console.log(`  Row ${rowIdx}:`, cells);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testAnchorReport().catch(console.error);
