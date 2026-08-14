import { chromium } from 'playwright';

async function researchDetail() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  
  try {
    const page = await context.newPage();
    console.log('Testing IPO Detail for Promoters and Anchors...');
    await page.goto('https://ipowatch.in/horizon-industrial-parks-ipo/', { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    
    const promoterMatch = text.match(/Promoter[^\n]+/i) || text.match(/Promoters[^\n]+/i);
    const anchorMatch = text.match(/Anchor[^\n]+/i);
    const qibMatch = text.match(/QIB[^\n]+/i);
    const reviewMatch = text.match(/Review[^\n]+/i) || text.match(/Rating[^\n]+/i);
    
    console.log('Promoter Match:', promoterMatch ? promoterMatch[0] : 'Not found');
    console.log('Anchor Match:', anchorMatch ? anchorMatch[0] : 'Not found');
    console.log('QIB Match:', qibMatch ? qibMatch[0] : 'Not found');
    console.log('Review Match:', reviewMatch ? reviewMatch[0] : 'Not found');
    
    // Let's print a chunk around "Promoter" to see structure
    const pIdx = text.toLowerCase().indexOf('promoter');
    if (pIdx !== -1) {
      console.log('\n--- Context around Promoter ---');
      console.log(text.substring(pIdx - 100, pIdx + 300));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
researchDetail();
