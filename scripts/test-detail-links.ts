import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function listDetailLinks() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const detailUrl = 'https://www.chittorgarh.com/ipo/behari-lal-engineering-ipo/2659/';
    console.log('Navigating to detail page:', detailUrl);
    await page.goto(detailUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('table', { timeout: 15000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('\n--- All PDF / Document / Prospectus Links ---');
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (
        href.includes('.pdf') || 
        text.toLowerCase().includes('drhp') || 
        text.toLowerCase().includes('rhp') || 
        text.toLowerCase().includes('prospectus') ||
        text.toLowerCase().includes('document')
      ) {
        console.log(`  🔗 Text: "${text}" | Href: "${href}"`);
      }
    });

    console.log('\n--- Tables Found on Page ---');
    $('table').each((i, el) => {
      const firstRow = $(el).find('tr').first().text().replace(/\s+/g, ' ').trim();
      console.log(`  Table ${i}: ${firstRow.substring(0, 100)}`);
    });

    console.log('\n--- Headings Found on Page ---');
    $('h2, h3').each((i, el) => {
      console.log(`  H: ${$(el).text().trim()}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

listDetailLinks().catch(console.error);
