import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function findAndDumpClosedIPO() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Chittorgarh mainline list...');
    await page.goto('https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('table', { timeout: 15000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    let targetUrl = '';
    let targetCompany = '';
    
    // Find a row where Listing Date (nth column 4) is present and not empty
    const trsCount = await page.locator('table tbody tr').count();
    for (let i = 0; i < trsCount; i++) {
      const rowLocator = page.locator('table tbody tr').nth(i);
      const tdsCount = await rowLocator.locator('td').count();
      if (tdsCount >= 6) {
        const companyCell = rowLocator.locator('td').nth(0);
        const companyName = await companyCell.innerText();
        const href = await companyCell.locator('a').getAttribute('href') || '';
        const listingDate = await rowLocator.locator('td').nth(4).innerText();
        
        if (href && listingDate.trim().length > 3) {
          targetUrl = href;
          targetCompany = companyName.trim();
          break;
        }
      }
    }

    if (!targetUrl) {
      console.log('No listed/closed IPO found in table. Using a fallback index...');
      const firstRowLink = $('table tbody tr').first().find('td').first().find('a').attr('href');
      if (firstRowLink) {
        targetUrl = firstRowLink;
        targetCompany = 'First Row IPO';
      }
    }

    if (targetUrl) {
      console.log(`Found target company: "${targetCompany}" URL: ${targetUrl}`);
      
      // Navigate to detail page
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await page.waitForSelector('table', { timeout: 15000 });
      const detailHtml = await page.content();
      const $detail = cheerio.load(detailHtml);

      console.log('\nDumping all tables on detail page...');
      $detail('table').each((tableIdx, tableEl) => {
        const firstRow: string[] = [];
        $detail(tableEl).find('tr').first().find('th, td').each((i, el) => {
          firstRow.push($detail(el).text().trim().replace(/\s+/g, ' '));
        });
        console.log(`Table ${tableIdx}: class="${$detail(tableEl).attr('class') || ''}" rows=${$detail(tableEl).find('tr').length} first row =`, firstRow.slice(0, 5));
      });

      // Let's check if the word "anchor" or "promoter" exists
      const bodyText = await page.locator('body').innerText();
      const lines = bodyText.split('\n');
      console.log('\n--- Company Promoters Line Check ---');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('promoters:')) {
          console.log(`Line ${idx}: ${line.trim()}`);
        }
      });
    } else {
      console.log('No IPO link discovered.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

findAndDumpClosedIPO().catch(console.error);
