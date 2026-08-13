import { chromium } from 'playwright';

async function fetchIPOs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  const page = await context.newPage();

  const ipos = [];

  try {
    console.log('Navigating to investorgain...');
    await page.goto('https://www.investorgain.com/report/live-ipo-gmp/331/ipo/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Investorgain table parser
    const rows = await page.locator('table#mainboardipo tbody tr').all();
    console.log(`Found ${rows.length} rows`);

    for (const row of rows) {
      const tds = await row.locator('td').allInnerTexts();
      if (tds.length >= 8) {
        let company = tds[0].trim();
        // Remove " IPO" or any suffixes from company name for cleaner matching
        company = company.replace(/ IPO.*/i, '').trim();
        
        let priceBand = tds[2].trim();
        
        // Investorgain open/close dates
        let openDate = tds[4].trim();
        let closeDate = tds[5].trim();
        
        // Basic mapping for Investorgain stage
        let stage = 6; // Default to Upcoming
        if (openDate && closeDate) {
           stage = 8; // Open
        }

        ipos.push({
          company_name: company,
          sector: 'Unknown',
          stage: stage,
          price_band: priceBand,
          open_date: openDate,
          close_date: closeDate
        });
      }
    }
  } catch (err) {
    console.error('Error scraping investorgain:', err);
  }

  await browser.close();

  console.log(`Scraped ${ipos.length} IPOs. Sending to API...`);

  // Send to API
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const syncSecret = process.env.SYNC_SECRET || 'dev-secret';

  if (ipos.length > 0) {
    try {
      const response = await fetch(`${apiUrl}/api/sync-ipos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${syncSecret}`
        },
        body: JSON.stringify({ ipos })
      });

      const result = await response.json();
      console.log('Sync result:', result);
    } catch (e) {
      console.error('Failed to post to sync API:', e);
    }
  }
}

fetchIPOs().catch(console.error);
