import { chromium } from 'playwright';

async function validateExtraction() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    const page = await context.newPage();

    const testUrls = [
      'https://ipowatch.in/gaja-alternative-asset-management-ipo/'
    ];

    for (const url of testUrls) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: ${url}`);
      console.log('='.repeat(60));

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const text = await page.locator('body').innerText();

      // --- Promoters ---
      const promoterSentenceMatch = text.match(/[Tt]he\s+promoters?\s+of\s+the\s+company\s+(?:is|are)\s+([^\n.]{5,400})/i);
      if (promoterSentenceMatch) {
        const promoters = promoterSentenceMatch[1].replace(/[.\s]+$/, '').trim();
        console.log(`✅ PROMOTERS: ${promoters}`);
      } else {
        console.log('❌ PROMOTERS: Not found via sentence match');
      }

      // --- Listing Date ---
      const listingMatch = text.match(/IPO Listing Date:\s*([^\n]+)/i);
      if (listingMatch) {
        const dateStr = listingMatch[1].trim();
        const parsed = new Date(dateStr);
        console.log(`✅ LISTING DATE: ${dateStr} → ${!isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : 'PARSE FAILED'}`);
      }

      // --- Anchor Investors & QIB ---
      const allTables = await page.locator('table').all();
      let qibFound = false;
      let anchorFound = false;

      for (const table of allTables) {
        const tableText = await table.innerText();

        // QIB Quota table: unique marker is 'QIB (Ex. Anchor)'
        if (tableText.includes('QIB (Ex. Anchor)') && tableText.includes('Retail')) {
          const tableRows = await table.locator('tr').all();
          const quotaLines = [];
          for (const row of tableRows) {
            const cells = await row.locator('td, th').allInnerTexts();
            if (cells.length >= 2) {
              const label = cells[0].trim();
              const shares = cells[1].trim();
              const pct = cells.length >= 3 ? cells[2].trim() : '';
              if (!label || label === 'Investor Category' || label === '-% Shares') continue;
              if (!shares || shares === 'Share Offered') continue;
              const cleanShares = shares.replace('[.]', 'TBA');
              const cleanPct = pct.replace('[.]', 'TBA').replace('-%', 'TBA');
              quotaLines.push(`${label}: ${cleanShares}${cleanPct ? ` (${cleanPct})` : ''}`);
            }
          }
          if (quotaLines.length > 0) {
            qibFound = true;
            console.log(`✅ QIB DETAILS: ${quotaLines.join(' | ')}`);
          }
        }

        // Anchor details table: unique marker is 'Anchor Bidding Date'
        if (tableText.includes('Anchor Bidding Date')) {
          const tableRows = await table.locator('tr').all();
          let anchorDate = '';
          let anchorSize = '';
          let anchorList = '';
          for (const row of tableRows) {
            const cells = await row.locator('td, th').allInnerTexts();
            if (cells.length >= 2) {
              const label = cells[0].trim();
              const value = cells[1].trim();
              if (label === 'Anchor Investors List' && value && !value.includes('[.]')) anchorList = value;
              if (label === 'Anchor Bidding Date' && value) anchorDate = value;
              if (label === 'Anchor Size' && value && !value.includes('[.]')) anchorSize = value;
            }
          }
          anchorFound = true;
          if (anchorList) {
            console.log(`✅ ANCHOR INVESTORS (names): ${anchorList}`);
          } else if (anchorDate) {
            console.log(`✅ ANCHOR INVESTORS (scheduled): Scheduled: ${anchorDate}${anchorSize ? ` | Size: ${anchorSize}` : ''}`);
          } else {
            console.log('⚠️  ANCHOR INVESTORS: Table found but no data');
          }
        }
      }
      
      if (!anchorFound) console.log('❌ ANCHOR INVESTORS: Anchor table not found');
      if (!qibFound) console.log('❌ QIB DETAILS: QIB quota table not found');
    }

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await browser.close();
  }
}

validateExtraction().catch(console.error);
