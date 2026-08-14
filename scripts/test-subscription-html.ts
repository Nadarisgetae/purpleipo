import { chromium } from 'playwright';
import fs from 'fs';

async function testSubscriptionHtml() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing IPO Subscription Watch...');
    await page.goto('https://ipowatch.in/ipo-subscription-status-live-bidding-data/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    fs.writeFileSync('ipowatch-sub.html', html);
    console.log('Saved ipowatch-sub.html');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testSubscriptionHtml();
