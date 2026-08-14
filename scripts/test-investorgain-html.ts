import { chromium } from 'playwright';
import fs from 'fs';

async function testInvestorgainHtml() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  try {
    const page = await context.newPage();
    await page.goto('https://www.investorgain.com/report/live-ipo-gmp/331/ipo/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    fs.writeFileSync('investorgain.html', html);
    console.log('Saved investorgain.html');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testInvestorgainHtml().catch(console.error);
