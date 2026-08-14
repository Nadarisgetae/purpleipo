import { chromium } from 'playwright';
import fs from 'fs';

async function dumpSME() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing SME IPO Watch...');
    await page.goto('https://ipowatch.in/sme-ipo-gmp-live-rates/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    fs.writeFileSync('ipowatch-sme.html', html);
    console.log('Saved ipowatch-sme.html');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
dumpSME();
