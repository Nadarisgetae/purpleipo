import { chromium } from 'playwright';

async function testDetail() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing IPO Detail...');
    await page.goto('https://ipowatch.in/skyways-air-services-ipo-gmp-review-price-allotment/', { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    const lotSizeMatch = text.match(/Lot Size\s+([^\n]+)/i);
    const minInvMatch = text.match(/Minimum Amount\s+([^\n]+)/i);
    
    console.log('Lot Size Match:', lotSizeMatch ? lotSizeMatch[0] : 'Not found');
    console.log('Min Inv Match:', minInvMatch ? minInvMatch[0] : 'Not found');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
testDetail();
