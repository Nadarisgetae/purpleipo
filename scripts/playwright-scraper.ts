import { chromium } from 'playwright';

async function fetchIPOs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const iposMap = new Map<string, any>();

  try {
    // 1. Fetch Subscription Data
    console.log('Navigating to Subscription Data...');
    await page.goto('https://ipowatch.in/ipo-subscription-status-today/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const subRows = await page.locator('table tbody tr').all();
    for (const row of subRows) {
      const tds = await row.locator('td').allInnerTexts();
      if (tds.length >= 7) {
        let name = tds[0].replace(/ IPO.*/i, '').trim();
        iposMap.set(name, {
           subscription_rate: tds[6].trim(), // Total (X)
        });
      }
    }

    // 2. Fetch GMP and core list (Mainboard + SME)
    const urls = [
      'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/',
      'https://ipowatch.in/sme-ipo-gmp-live-rates/'
    ];

    for (const url of urls) {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      const rows = await page.locator('figure.wp-block-table table tbody tr').all();
      console.log(`Found ${rows.length} rows on this page`);

      for (let i = 1; i < rows.length; i++) {
        const tds = await rows[i].locator('td').allInnerTexts();
        
        if (tds.length >= 8) {
          let company = tds[0].replace(/ IPO.*/i, '').trim();
          let gmpText = tds[1].replace(/[^\d.-]/g, '').trim();
          let priceBand = tds[3].trim();
          let dates = tds[5].trim();
          let type = tds[6].trim();
          let status = tds[7].trim();
          
          let stage = 6; 
          const statusLower = status.toLowerCase();
          if (statusLower.includes('upcoming') || statusLower.includes('announced')) stage = 6;
          else if (statusLower.includes('open')) stage = 8;
          else if (statusLower.includes('close')) stage = 10;
          else if (statusLower.includes('list')) stage = 12;

          let openDate = null, closeDate = null;
          const dateMatch = dates.match(/(\d+)-(\d+)\s+([a-zA-Z]+)/);
          if (dateMatch) {
             const [_, start, end, month] = dateMatch;
             const year = new Date().getFullYear();
             openDate = `${year}-${month}-${start}`;
             closeDate = `${year}-${month}-${end}`;
          }

          // Get detail link
          let href = null;
          try {
            href = await rows[i].locator('td:first-child a').getAttribute('href', { timeout: 1000 });
          } catch (e) { }

          // Merge with existing subscription data if any
          const existing = iposMap.get(company) || {};
          
          iposMap.set(company, {
            ...existing,
            company_name: company,
            sector: type,
            type: type,
            stage: stage,
            price_band: priceBand === '₹-' || priceBand === '-' ? null : priceBand,
            gmp: gmpText ? parseFloat(gmpText) : null,
            open_date: openDate,
            close_date: closeDate,
            href: href
          });
        }
      }
    }

    // 3. Fetch Details for each active IPO
    const ipos = Array.from(iposMap.values()).filter(ipo => ipo.company_name);
    
    console.log(`Extracting details for ${ipos.length} IPOs...`);
    for (let i = 0; i < ipos.length; i++) {
      if (ipos[i].href) {
        console.log(`Fetching details for ${ipos[i].company_name}...`);
        try {
          await page.goto(ipos[i].href, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const text = await page.locator('body').innerText();
          
          // ── ISSUE SIZE ──
          const issueSizeMatch = text.match(/Issue Size[^\n]+/i);
          if (issueSizeMatch) {
             const sizeParts = issueSizeMatch[0].split('\t');
             if (sizeParts.length > 1) ipos[i].issue_size = sizeParts[1].replace('Approx ', '').trim();
          }
          
          // ── LOT SIZE & MINIMUM INVESTMENT ──
          const retailMatch = text.match(/Retail Minimum[^\n]+/i);
          if (retailMatch) {
             const parts = retailMatch[0].split('\t');
             if (parts.length >= 4) {
               ipos[i].lot_size = parts[2].trim();
               ipos[i].minimum_investment = parts[3].trim();
             }
          }

          // ── LISTING DATE ──
          const listingMatch = text.match(/IPO Listing Date:\s*([^\n]+)/i);
          if (listingMatch) {
            const dateStr = listingMatch[1].trim();
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              ipos[i].listing_date = parsed.toISOString().split('T')[0];
            }
          }

          // ── PROMOTERS: extract from "The promoters of the company are..." sentence ──
          // ipowatch.in always has this sentence in the "Promoters and Holding Pattern" section
          const promoterSentenceMatch = text.match(/[Tt]he\s+promoters?\s+of\s+the\s+company\s+(?:is|are)\s+([^\n.]{5,400})/i);
          if (promoterSentenceMatch) {
            // Clean up trailing punctuation
            ipos[i].promoters = promoterSentenceMatch[1].replace(/[.\s]+$/, '').trim();
          } else {
            // Fallback: search for Mr./Ms./Mrs./Dr. names in the promoter section
            const promoterSectionIdx = text.indexOf('Promoters and Holding Pattern');
            if (promoterSectionIdx !== -1) {
              const section = text.substring(promoterSectionIdx, promoterSectionIdx + 800);
              const nameMatches = section.match(/(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g);
              if (nameMatches && nameMatches.length > 0) {
                ipos[i].promoters = nameMatches.join(', ');
              }
            }
          }

          // ── DOM TABLE EXTRACTION for Anchor Investors & QIB quota ──
          // Table 4: Quota table  → contains 'QIB (Ex. Anchor)' and 'Retail'
          // Table 5: Anchor table → contains 'Anchor Bidding Date'
          // Both are separate; inspect all tables without early exit.
          const allTables = await page.locator('table').all();
          for (const table of allTables) {
            const tableText = await table.innerText();

            // ── QIB / INVESTOR CATEGORY QUOTA TABLE ──
            // Unique signature: 'QIB (Ex. Anchor)' only appears in the quota reservation table
            if (tableText.includes('QIB (Ex. Anchor)') && tableText.includes('Retail')) {
              const tableRows = await table.locator('tr').all();
              const quotaLines: string[] = [];
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
                ipos[i].qib_details = quotaLines.join(' | ');
              }
            }

            // ── ANCHOR INVESTORS DETAILS TABLE ──
            // Unique signature: 'Anchor Bidding Date' only appears in the anchor details table
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
                  if (label === 'Anchor Investors List' && value && !value.includes('[.]')) {
                    anchorList = value;
                  }
                  if (label === 'Anchor Bidding Date' && value) {
                    anchorDate = value;
                  }
                  if (label === 'Anchor Size' && value && !value.includes('[.]')) {
                    anchorSize = value;
                  }
                }
              }
              if (anchorList) {
                // Real investor names are published post-allocation
                ipos[i].anchor_investors = anchorList;
              } else if (anchorDate) {
                // Anchor allocation is scheduled but names not yet published
                ipos[i].anchor_investors = `Scheduled: ${anchorDate}${anchorSize ? ` | Size: ${anchorSize}` : ''}`;
              }
            }
          }

          // ── RATING / REVIEW SCORE ──
          const reviewMatch = text.match(/Review[^\n]+/i) || text.match(/Rating[^\n]+/i);
          if (reviewMatch) {
             const parts = reviewMatch[0].split('\t');
             if (parts.length > 1) {
               const ratingMatch = parts[1].match(/[\d.]+/);
               if (ratingMatch) ipos[i].rating_score = parseFloat(ratingMatch[0]);
             }
          }
        } catch (e) {
          console.error(`Failed to fetch details for ${ipos[i].company_name}`);
        }
      }
    }

    await browser.close();

    console.log(`Scraped ${ipos.length} IPOs. Sending to API...`);

    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const syncSecret = process.env.SYNC_SECRET || 'dev-secret';

    if (ipos.length > 0) {
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
    }

  } catch (err) {
    console.error('Error scraping IPO Watch:', err);
    await browser.close();
  }
}

fetchIPOs().catch(console.error);
