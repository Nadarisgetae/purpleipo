import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const env = readFileSync('.env.local', 'utf8');
    for (const line of env.split('\n')) {
      const clean = line.replace(/\r/g, '').trim();
      if (!clean || clean.startsWith('#')) continue;
      const eqIdx = clean.indexOf('=');
      if (eqIdx === -1) continue;
      const key = clean.substring(0, eqIdx).trim();
      let val = clean.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[key] = val;
    }
  } catch (e) {}
}
loadEnv();

async function gotoWithRetry(page: any, url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return true;
    } catch (err) {
      console.log(`Failed to load ${url}, retrying (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return false;
}

async function fetchIPOs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const iposMap = new Map<string, any>();

  try {
    // Initialize Gemini
    const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-3.6-flash' }) : null;

    // 1. Fetch Subscription Data
    console.log('Navigating to Subscription Data...');
    await gotoWithRetry(page, 'https://ipowatch.in/ipo-subscription-status-today/');
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
      await gotoWithRetry(page, url);
      
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
          const success = await gotoWithRetry(page, ipos[i].href);
          if (!success) continue;
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

          // ── PROMOTERS, ANCHOR, QIB (Gemini Extraction) ──
          if (model) {
            try {
              const prompt = `Extract the following details from this IPO webpage text. If a piece of data is completely missing, return null for that field. Return ONLY valid JSON:
{
  "promoters": "Comma separated list of promoter names",
  "anchor_investors": "List of anchor investors or anchor schedule",
  "qib_details": "Details about QIB quota or subscription"
}
Webpage text:
${text.substring(0, 15000)}`;
              const result = await model.generateContent(prompt);
              const responseText = result.response.text();
              const cleanJson = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
              const parsed = JSON.parse(cleanJson);
              
              if (parsed.promoters) ipos[i].promoters = parsed.promoters;
              if (parsed.anchor_investors) ipos[i].anchor_investors = parsed.anchor_investors;
              if (parsed.qib_details) ipos[i].qib_details = parsed.qib_details;
            } catch (err) {
              console.error('Gemini extraction failed for', ipos[i].company_name);
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
