/**
 * Direct DB Promoter/Anchor/QIB Updater v2
 * Scrapes ipowatch.in detail pages and writes directly to the database.
 * Uses full company name matching + RETURNING to confirm updates.
 */
import { chromium } from 'playwright';
import postgres from 'postgres';
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
      if (key.includes('\0') || val.includes('\0')) continue;
      process.env[key] = val;
    }
  } catch (e) {}
}
loadEnv();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('No DATABASE_URL!'); process.exit(1); }

const sql = postgres(DB_URL, { ssl: 'require' });

async function scrapeDetails(page, href, companyName) {
  const result = { promoters: null, anchor_investors: null, qib_details: null, listing_date: null };
  try {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const text = await page.locator('body').innerText();

    // ── PROMOTERS ──
    const promoterSentenceMatch = text.match(/[Tt]he\s+promoters?\s+of\s+the\s+company\s+(?:is|are)\s+([^\n.]{5,400})/i);
    if (promoterSentenceMatch) {
      result.promoters = promoterSentenceMatch[1].replace(/[.\s]+$/, '').trim();
    } else {
      const idx = text.indexOf('Promoters and Holding Pattern');
      if (idx !== -1) {
        const section = text.substring(idx, idx + 800);
        const nameMatches = section.match(/(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g);
        if (nameMatches?.length > 0) result.promoters = nameMatches.join(', ');
      }
    }

    // ── LISTING DATE ──
    const listingMatch = text.match(/IPO Listing Date:\s*([^\n]+)/i);
    if (listingMatch) {
      const parsed = new Date(listingMatch[1].trim());
      if (!isNaN(parsed.getTime())) result.listing_date = parsed.toISOString().split('T')[0];
    }

    // ── TABLE EXTRACTION ──
    const allTables = await page.locator('table').all();
    for (const table of allTables) {
      const tableText = await table.innerText();

      // QIB Quota table
      if (tableText.includes('QIB (Ex. Anchor)') && tableText.includes('Retail')) {
        const tableRows = await table.locator('tr').all();
        const lines = [];
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
            lines.push(`${label}: ${cleanShares}${cleanPct ? ` (${cleanPct})` : ''}`);
          }
        }
        if (lines.length > 0) result.qib_details = lines.join(' | ');
      }

      // Anchor details table
      if (tableText.includes('Anchor Bidding Date')) {
        const tableRows = await table.locator('tr').all();
        let anchorDate = '', anchorSize = '', anchorList = '';
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
        if (anchorList) {
          result.anchor_investors = anchorList;
        } else if (anchorDate) {
          result.anchor_investors = `Scheduled: ${anchorDate}${anchorSize ? ` | Size: ${anchorSize}` : ''}`;
        }
      }
    }
  } catch (e) {
    console.error(`  ❌ Error scraping ${companyName}: ${e.message}`);
  }
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Load ALL companies from DB to build a lookup map
    console.log('📂 Loading all companies from DB...');
    const allCompanies = await sql`
      SELECT c.id as company_id, c.name, i.id as ipo_id 
      FROM companies c JOIN ipos i ON i.company_id = c.id
    `;
    
    // Build a map: normalized_name → ipo_id
    const nameToIpoId = new Map();
    for (const row of allCompanies) {
      const norm = row.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      nameToIpoId.set(norm, { ipo_id: row.ipo_id, name: row.name });
    }
    console.log(`  Loaded ${allCompanies.length} companies from DB`);

    // Collect all IPOs from ipowatch.in
    console.log('\n📋 Fetching IPO list from ipowatch.in...');
    const iposToUpdate = [];
    const urls = [
      'https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/',
      'https://ipowatch.in/sme-ipo-gmp-live-rates/'
    ];

    for (const url of urls) {
      console.log(`  Loading ${url}...`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const rows = await page.locator('figure.wp-block-table table tbody tr').all();
        for (let i = 1; i < rows.length; i++) {
          const tds = await rows[i].locator('td').allInnerTexts();
          if (tds.length >= 8) {
            const rawName = tds[0].replace(/ IPO.*/i, '').trim();
            let href = null;
            try { href = await rows[i].locator('td:first-child a').getAttribute('href', { timeout: 1000 }); } catch(e) {}
            if (href) iposToUpdate.push({ rawName, href });
          }
        }
      } catch (e) { console.error(`  Failed: ${e.message}`); }
    }

    console.log(`\n🔍 Found ${iposToUpdate.length} IPOs to update\n`);

    let updated = 0, notFound = 0, failed = 0;

    for (const { rawName, href } of iposToUpdate) {
      // Normalize name for matching
      const normRaw = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Try exact normalized match first, then partial
      let match = nameToIpoId.get(normRaw);
      if (!match) {
        // Try partial: find any DB name whose normalized form includes the first 8 chars
        const prefix8 = normRaw.substring(0, Math.min(8, normRaw.length));
        for (const [key, val] of nameToIpoId.entries()) {
          if (key.includes(prefix8) || prefix8.includes(key.substring(0, 8))) {
            match = val;
            break;
          }
        }
      }

      if (!match) {
        console.log(`⚠️  "${rawName}" — not in DB, skipping`);
        notFound++;
        continue;
      }

      console.log(`⚙️  ${rawName} → DB: "${match.name}"`);
      const details = await scrapeDetails(page, href, rawName);

      console.log(`   Promoters: ${details.promoters ? details.promoters.substring(0,70) : 'not found'}`);
      console.log(`   Anchor:    ${details.anchor_investors ?? 'not found'}`);
      console.log(`   QIB:       ${details.qib_details ? details.qib_details.substring(0,70) : 'not found'}`);

      try {
        const updateResult = await sql`
          UPDATE ipos SET
            promoters = ${details.promoters},
            anchor_investors = ${details.anchor_investors},
            qib_details = ${details.qib_details},
            listing_date = COALESCE(${details.listing_date}, listing_date),
            updated_at = NOW()
          WHERE id = ${match.ipo_id}
          RETURNING id, promoters, anchor_investors, qib_details
        `;
        if (updateResult.length > 0) {
          console.log(`   ✅ Saved to DB (promoters=${updateResult[0].promoters ? 'YES' : 'NULL'})`);
          updated++;
        } else {
          console.log(`   ❌ UPDATE matched 0 rows for ipo_id=${match.ipo_id}`);
          failed++;
        }
      } catch(e) {
        console.error(`   ❌ DB error: ${e.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Done! Updated: ${updated}, Not in DB: ${notFound}, Failed: ${failed}`);

    // Quick final verification
    console.log('\n📊 Final DB check (first 8 with data):');
    const verify = await sql`
      SELECT c.name, i.promoters, i.anchor_investors, i.qib_details
      FROM ipos i JOIN companies c ON c.id = i.company_id
      WHERE i.promoters IS NOT NULL OR i.qib_details IS NOT NULL
      ORDER BY i.updated_at DESC
      LIMIT 8
    `;
    for (const r of verify) {
      console.log(`  ${r.name}: promoters=${r.promoters ? 'YES' : 'NO'}, qib=${r.qib_details ? 'YES' : 'NO'}, anchor=${r.anchor_investors ? 'YES' : 'NO'}`);
    }

  } finally {
    await browser.close();
    await sql.end();
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
