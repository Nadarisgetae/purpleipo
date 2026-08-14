import { chromium } from 'playwright';

async function debugPromoters() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  // Test a live IPO detail page from ipowatch.in
  // Using a known recent IPO
  const testUrls = [
    'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/',
  ];

  try {
    const page = await context.newPage();
    
    // First, get the list page to find actual IPO URLs
    console.log('Loading main GMP page...');
    await page.goto('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Grab first few IPO detail links
    const links = await page.locator('figure.wp-block-table table tbody tr td:first-child a').all();
    const hrefs: string[] = [];
    for (const link of links.slice(0, 3)) {
      const href = await link.getAttribute('href');
      if (href) hrefs.push(href);
    }
    console.log('Found IPO links:', hrefs);
    
    // Test each detail page
    for (const href of hrefs) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${href}`);
      console.log('='.repeat(60));
      
      try {
        await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        
        const bodyText = await page.locator('body').innerText();
        
        // Find all table-like structures with promoter info
        // Search for promoter section
        const pIdx = bodyText.toLowerCase().indexOf('promoter');
        if (pIdx !== -1) {
          console.log('\n--- PROMOTER CONTEXT ---');
          console.log(bodyText.substring(Math.max(0, pIdx - 50), pIdx + 500));
        } else {
          console.log('\nNo "promoter" found in page text');
        }

        const aIdx = bodyText.toLowerCase().indexOf('anchor');
        if (aIdx !== -1) {
          console.log('\n--- ANCHOR CONTEXT ---');
          console.log(bodyText.substring(Math.max(0, aIdx - 50), aIdx + 500));
        } else {
          console.log('\nNo "anchor" found in page text');
        }

        const qIdx = bodyText.toLowerCase().indexOf('qib');
        if (qIdx !== -1) {
          console.log('\n--- QIB CONTEXT ---');
          console.log(bodyText.substring(Math.max(0, qIdx - 50), qIdx + 500));
        } else {
          console.log('\nNo "QIB" found in page text');
        }

        // Also try to read the HTML structure around promoters 
        const tables = await page.locator('table').all();
        console.log(`\nFound ${tables.length} tables on page`);
        
        for (let t = 0; t < tables.length; t++) {
          const tableText = await tables[t].innerText();
          if (tableText.toLowerCase().includes('promoter') || 
              tableText.toLowerCase().includes('anchor') ||
              tableText.toLowerCase().includes('qib')) {
            console.log(`\n--- TABLE ${t} (contains promoter/anchor/qib) ---`);
            console.log(tableText.substring(0, 800));
          }
        }
        
      } catch (e: any) {
        console.error(`Failed for ${href}: ${e.message}`);
      }
    }

    // Also test chittorgarh for promoter data
    console.log('\n' + '='.repeat(60));
    console.log('Testing Chittorgarh IPO detail page...');
    console.log('='.repeat(60));
    
    try {
      // Get a chittorgarh detail page
      await page.goto('https://www.chittorgarh.com/report/mainboard-ipo-list-in-india/29/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const cgLinks = await page.locator('table a[href*="/ipo/"]').all();
      if (cgLinks.length > 0) {
        const cgHref = await cgLinks[0].getAttribute('href');
        if (cgHref) {
          console.log(`\nChittorgarh IPO: ${cgHref}`);
          const cgUrl = cgHref.startsWith('http') ? cgHref : `https://www.chittorgarh.com${cgHref}`;
          await page.goto(cgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1000);
          
          const cgText = await page.locator('body').innerText();
          
          const pIdx2 = cgText.toLowerCase().indexOf('promoter');
          if (pIdx2 !== -1) {
            console.log('\n--- CHITTORGARH PROMOTER CONTEXT ---');
            console.log(cgText.substring(Math.max(0, pIdx2 - 50), pIdx2 + 800));
          }
          
          const aIdx2 = cgText.toLowerCase().indexOf('anchor');
          if (aIdx2 !== -1) {
            console.log('\n--- CHITTORGARH ANCHOR CONTEXT ---');
            console.log(cgText.substring(Math.max(0, aIdx2 - 50), aIdx2 + 600));
          }
          
          const qIdx2 = cgText.toLowerCase().indexOf('qib');
          if (qIdx2 !== -1) {
            console.log('\n--- CHITTORGARH QIB CONTEXT ---');
            console.log(cgText.substring(Math.max(0, qIdx2 - 50), qIdx2 + 600));
          }
        }
      }
    } catch (e: any) {
      console.error('Chittorgarh test failed:', e.message);
    }

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await browser.close();
  }
}

debugPromoters().catch(console.error);
